import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { DeviceInfo, SignalMessage } from "./types";
import { sha256 } from "./util";

/**
 * Signaling only. Devices exchange WebRTC session descriptions through a
 * short-lived realtime room; the actual files never touch a server — they flow
 * over the encrypted peer-to-peer data channel, which stays on the LAN when
 * both devices are on the same network.
 */
export interface SignalingHandlers {
  onPresence: (devices: DeviceInfo[]) => void;
  onSignal: (message: SignalMessage) => void;
  onStatus: (status: "connecting" | "ready" | "offline") => void;
}

/**
 * Derives a room key from the network's public egress address, so devices
 * behind the same router land in the same room automatically. Falls back to
 * null when the lookup is unavailable (VPN/blocked), in which case the user can
 * pair with a code.
 */
export async function detectNetworkRoom(): Promise<string | null> {
  const endpoints = ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"];
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { ip?: string };
      if (!json.ip) continue;
      const hash = await sha256(new TextEncoder().encode(`localsend:${json.ip}`));
      return `net-${hash.slice(0, 12)}`;
    } catch {
      /* try next endpoint */
    }
  }
  return null;
}

export class Signaling {
  private channel: RealtimeChannel | null = null;
  private readonly handlers: SignalingHandlers;
  private self: DeviceInfo | null = null;
  room: string | null = null;

  constructor(handlers: SignalingHandlers) {
    this.handlers = handlers;
  }

  async join(room: string, self: DeviceInfo): Promise<void> {
    if (this.room === room && this.channel && this.self?.name === self.name) return;
    await this.leave();
    this.room = room;
    this.self = self;
    this.handlers.onStatus("connecting");

    const channel = supabase.channel(`localsend:${room}`, {
      config: { presence: { key: self.id }, broadcast: { self: false } },
    });
    this.channel = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ device: DeviceInfo }>();
      const devices: DeviceInfo[] = [];
      for (const [key, entries] of Object.entries(state)) {
        if (key === self.id) continue;
        const entry = entries[0];
        if (entry?.device) devices.push(entry.device);
      }
      this.handlers.onPresence(devices);
    });

    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      const message = payload as SignalMessage;
      if (message.to !== self.id) return;
      this.handlers.onSignal(message);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ device: this.self });
        this.handlers.onStatus("ready");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.handlers.onStatus(status === "CLOSED" ? "offline" : "connecting");
      }
    });
  }

  async updateSelf(self: DeviceInfo): Promise<void> {
    this.self = self;
    if (this.channel) await this.channel.track({ device: self });
  }

  send(message: SignalMessage): void {
    void this.channel?.send({ type: "broadcast", event: "signal", payload: message });
  }

  async leave(): Promise<void> {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.room = null;
  }
}
