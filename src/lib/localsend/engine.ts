import { appendHistory, clearHistory, loadHistory } from "./history";
import { PeerConnection } from "./peer";
import { Signaling, detectNetworkRoom } from "./signaling";
import { createDiskSink, createMemorySink, loadDirectoryHandle, saveDirectoryHandle } from "./sink";
import type { FileSink } from "./sink";
import {
  clearIdentity,
  clearSettings,
  defaultSettings,
  loadIdentity,
  loadSettings,
  saveIdentity,
  saveSettings,
} from "./settings";
import type { Identity, KnownDevice, Settings } from "./settings";
import {
  notify,
  playErrorSound,
  playIncomingSound,
  playSuccessSound,
  vibrate,
} from "./feedback";
import type {
  Control,
  DeviceInfo,
  FileMeta,
  HistoryEntry,
  NetworkStatus,
  Peer,
  PeerConnState,
  SignalMessage,
  Transfer,
  TransferFile,
} from "./types";
import { CHUNK_SIZE, detectCapabilities, randomId, sha256, sha256OfHashes } from "./util";
import type { Capabilities } from "./util";

export interface OutgoingItem {
  file: File;
  path: string;
}

export interface ReceivedFile {
  fid: string;
  name: string;
  path: string;
  mime: string;
  size: number;
  blob: Blob | null;
  writtenToDisk: boolean;
}

export interface ReceivedText {
  id: string;
  from: DeviceInfo;
  text: string;
  at: number;
}

export interface EngineState {
  hydrated: boolean;
  identity: Identity;
  settings: Settings;
  status: NetworkStatus;
  room: string | null;
  roomIsAutomatic: boolean;
  discoveryError: string | null;
  peers: Peer[];
  transfers: Transfer[];
  texts: ReceivedText[];
  history: HistoryEntry[];
  capabilities: Capabilities;
  downloadFolder: string | null;
  pairingCode: string | null;
}

interface PeerRecord {
  info: DeviceInfo;
  conn: PeerConnection | null;
  state: PeerConnState;
  lastSeen: number;
  openWaiters: Array<() => void>;
}

interface SendRuntime {
  items: Map<string, OutgoingItem>;
  paused: boolean;
  cancelled: boolean;
  resumeWaiters: Array<() => void>;
  resumeFrom: Map<string, (chunk: number) => void>;
  ackWaiters: Map<string, (ok: boolean, reason?: string) => void>;
  approval?: (accepted: boolean) => void;
}

interface ReceiveRuntime {
  sinks: Map<string, FileSink>;
  received: Map<string, number>;
  hashes: Map<string, string[]>;
  pending: { fid: string; i: number; hash: string; size: number } | null;
  files: Map<string, ReceivedFile>;
}

const RECONNECT_DELAYS = [800, 1600, 3200, 5000];

export class LocalSendEngine {
  private state: EngineState;
  private listeners = new Set<() => void>();
  private peers = new Map<string, PeerRecord>();
  private signaling: Signaling;
  private sendRuntimes = new Map<string, SendRuntime>();
  private receiveRuntimes = new Map<string, ReceiveRuntime>();
  private speedTrack = new Map<string, { bytes: number; at: number; speed: number }>();
  private downloadDir: FileSystemDirectoryHandle | null = null;
  private notifyScheduled = false;
  private started = false;

  constructor() {
    this.state = {
      hydrated: false,
      identity: {
        id: "",
        name: "This device",
        type: "unknown",
        os: "Unknown",
        onboarded: false,
      },
      settings: defaultSettings,
      status: "offline",
      room: null,
      roomIsAutomatic: true,
      discoveryError: null,
      peers: [],
      transfers: [],
      texts: [],
      history: [],
      capabilities: {
        webrtc: false,
        dataChannel: false,
        fileSystemAccess: false,
        directoryPicker: false,
        clipboardRead: false,
        clipboardWrite: false,
        notifications: false,
        vibration: false,
        webShareTarget: false,
        crypto: false,
        streams: false,
      },
      downloadFolder: null,
      pairingCode: null,
    };
    this.signaling = new Signaling({
      onPresence: (devices) => this.handlePresence(devices),
      onSignal: (message) => void this.handleSignal(message),
      onStatus: (status) => this.patch({ status: status === "ready" ? "ready" : status === "connecting" ? "connecting" : "offline" }),
    });
  }

  /* ---------------- state plumbing ---------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): EngineState => this.state;

  private patch(partial: Partial<EngineState>, immediate = true): void {
    this.state = { ...this.state, ...partial };
    if (immediate) this.emit();
    else this.emitThrottled();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private emitThrottled(): void {
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    setTimeout(() => {
      this.notifyScheduled = false;
      this.emit();
    }, 120);
  }

  private get selfInfo(): DeviceInfo {
    const { id, name, type, os } = this.state.identity;
    return { id, name, type, os, joinedAt: Date.now() };
  }

  /* ---------------- lifecycle ---------------- */

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const identity = loadIdentity();
    const settings = loadSettings();
    this.patch({
      hydrated: true,
      identity,
      settings,
      history: loadHistory(),
      capabilities: detectCapabilities(),
    });
    void this.restoreDownloadFolder();
    window.addEventListener("online", () => void this.connect());
    window.addEventListener("offline", () => this.patch({ status: "offline" }));
    await this.connect();
  }

  private async restoreDownloadFolder(): Promise<void> {
    const handle = await loadDirectoryHandle();
    if (handle) {
      this.downloadDir = handle;
      this.patch({ downloadFolder: handle.name });
    }
  }

  async connect(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.patch({ status: "offline" });
      return;
    }
    this.patch({ status: "connecting", discoveryError: null });
    let override = this.state.settings.roomOverride;
    const pairedAt = this.state.settings.roomOverrideAt;
    const ttl = this.state.settings.sessionMinutes * 60_000;
    if (override && pairedAt && Date.now() - pairedAt > ttl) {
      override = null;
      this.updateSettings({ roomOverride: null, roomOverrideAt: null });
    }
    let room = override;
    let automatic = false;
    if (!room) {
      room = await detectNetworkRoom();
      automatic = true;
    }
    if (!room) {
      this.patch({
        status: "offline",
        discoveryError:
          "Automatic discovery could not identify your network. Pair with a QR code or pairing code instead.",
      });
      return;
    }
    this.patch({ room, roomIsAutomatic: automatic });
    await this.signaling.join(room, this.selfInfo);
  }

  async joinRoomCode(code: string): Promise<void> {
    const normalized = code.trim().replace(/\s+/g, "").toLowerCase();
    if (!normalized) return;
    this.updateSettings({ roomOverride: normalized, roomOverrideAt: Date.now() });
    await this.connect();
  }

  async useAutomaticRoom(): Promise<void> {
    this.updateSettings({ roomOverride: null, roomOverrideAt: null });
    await this.connect();
  }

  /* ---------------- identity + settings ---------------- */

  updateIdentity(partial: Partial<Identity>): void {
    const identity = { ...this.state.identity, ...partial };
    saveIdentity(identity);
    this.patch({ identity });
    void this.signaling.updateSelf(this.selfInfo);
  }

  updateSettings(partial: Partial<Settings>): void {
    const settings = { ...this.state.settings, ...partial };
    saveSettings(settings);
    this.patch({ settings });
  }

  private updateKnown(id: string, partial: Partial<KnownDevice>): void {
    const existing = this.state.settings.knownDevices[id];
    const peer = this.peers.get(id)?.info;
    const base: KnownDevice = existing ?? {
      id,
      name: peer?.name ?? "Unknown device",
      type: peer?.type ?? "unknown",
      os: peer?.os ?? "Unknown",
      lastSeen: Date.now(),
      trusted: false,
      blocked: false,
      favorite: false,
    };
    this.updateSettings({
      knownDevices: { ...this.state.settings.knownDevices, [id]: { ...base, ...partial } },
    });
  }

  setTrusted(id: string, trusted: boolean): void {
    this.updateKnown(id, { trusted });
  }
  setFavorite(id: string, favorite: boolean): void {
    this.updateKnown(id, { favorite });
  }
  setBlocked(id: string, blocked: boolean): void {
    this.updateKnown(id, { blocked });
    if (blocked) this.disconnectPeer(id);
    this.refreshPeers();
  }
  forgetDevice(id: string): void {
    const knownDevices = { ...this.state.settings.knownDevices };
    delete knownDevices[id];
    this.updateSettings({ knownDevices });
    this.disconnectPeer(id);
  }

  /* ---------------- discovery ---------------- */

  private handlePresence(devices: DeviceInfo[]): void {
    const now = Date.now();
    const seen = new Set<string>();
    for (const device of devices) {
      seen.add(device.id);
      const record = this.peers.get(device.id);
      if (record) {
        record.info = device;
        record.lastSeen = now;
      } else {
        this.peers.set(device.id, {
          info: device,
          conn: null,
          state: "idle",
          lastSeen: now,
          openWaiters: [],
        });
      }
      const known = this.state.settings.knownDevices[device.id];
      if (known) this.updateKnown(device.id, { lastSeen: now, name: device.name, type: device.type });
    }
    for (const [id, record] of this.peers) {
      if (!seen.has(id)) {
        record.state = "idle";
        this.peers.delete(id);
        this.markPeerGone(id);
      }
    }
    this.refreshPeers();
  }

  private markPeerGone(id: string): void {
    for (const transfer of this.state.transfers) {
      if (transfer.peer.id === id && (transfer.status === "active" || transfer.status === "paused")) {
        this.updateTransfer(transfer.id, {
          status: "interrupted",
          error: "Device went offline. LocalSend will resume when it reappears.",
        });
      }
    }
  }

  private refreshPeers(): void {
    const blocked = this.state.settings.knownDevices;
    const peers: Peer[] = Array.from(this.peers.values())
      .filter((record) => !blocked[record.info.id]?.blocked)
      .map((record) => ({ info: record.info, conn: record.state, lastSeen: record.lastSeen }))
      .sort((a, b) => {
        const favA = blocked[a.info.id]?.favorite ? 0 : 1;
        const favB = blocked[b.info.id]?.favorite ? 0 : 1;
        if (favA !== favB) return favA - favB;
        return a.info.name.localeCompare(b.info.name);
      });
    this.patch({ peers });
  }

  /* ---------------- connections ---------------- */

  private getOrCreatePeer(id: string, info?: DeviceInfo): PeerRecord {
    let record = this.peers.get(id);
    if (!record) {
      record = {
        info: info ?? { id, name: "Unknown device", type: "unknown", os: "Unknown", joinedAt: Date.now() },
        conn: null,
        state: "idle",
        lastSeen: Date.now(),
        openWaiters: [],
      };
      this.peers.set(id, record);
    }
    if (info) record.info = info;
    return record;
  }

  private setPeerState(id: string, state: PeerConnState): void {
    const record = this.peers.get(id);
    if (!record) return;
    record.state = state;
    this.refreshPeers();
  }

  private createConnection(id: string, initiator: boolean): PeerConnection {
    const record = this.getOrCreatePeer(id);
    const polite = this.state.identity.id > id;
    const conn = new PeerConnection(
      {
        onSignal: (kind, payload) =>
          this.signaling.send({ from: this.state.identity.id, to: id, kind, payload, device: this.selfInfo }),
        onControl: (message) => void this.handleControl(id, message),
        onBinary: (data) => void this.handleBinary(id, data),
        onStateChange: (state) => {
          if (state === "connected") this.setPeerState(id, "connected");
          else if (state === "connecting") this.setPeerState(id, "connecting");
          else if (state === "failed") this.setPeerState(id, "failed");
        },
        onOpen: () => {
          this.setPeerState(id, "connected");
          const waiters = record.openWaiters.splice(0);
          for (const waiter of waiters) waiter();
          void this.resumeInterrupted(id);
        },
        onClose: () => {
          if (record.conn === conn) {
            record.conn = null;
            this.setPeerState(id, this.peers.has(id) ? "reconnecting" : "idle");
            this.markInterrupted(id);
          }
        },
      },
      polite,
    );
    record.conn = conn;
    this.setPeerState(id, "connecting");
    if (initiator) conn.createChannel();
    return conn;
  }

  private markInterrupted(id: string): void {
    for (const transfer of this.state.transfers) {
      if (transfer.peer.id === id && (transfer.status === "active" || transfer.status === "paused")) {
        this.updateTransfer(transfer.id, {
          status: "interrupted",
          error: "Connection interrupted. Attempting to reconnect…",
        });
      }
    }
  }

  private disconnectPeer(id: string): void {
    const record = this.peers.get(id);
    record?.conn?.close();
    if (record) record.conn = null;
  }

  async ensureConnected(id: string): Promise<PeerConnection> {
    const record = this.getOrCreatePeer(id);
    if (record.conn?.isOpen) return record.conn;
    let attempt = 0;
    while (attempt < RECONNECT_DELAYS.length + 1) {
      const conn = record.conn ?? this.createConnection(id, true);
      if (conn.isOpen) return conn;
      const opened = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(conn.isOpen), 8000);
        record.openWaiters.push(() => {
          clearTimeout(timer);
          resolve(true);
        });
      });
      if (opened && conn.isOpen) return conn;
      conn.close();
      record.conn = null;
      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)]!;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
    this.setPeerState(id, "failed");
    throw new Error("Could not reach that device. Make sure both devices are on the same network.");
  }

  private async handleSignal(message: SignalMessage): Promise<void> {
    if (this.state.settings.knownDevices[message.from]?.blocked) return;
    const record = this.getOrCreatePeer(message.from, message.device);
    const conn = record.conn ?? this.createConnection(message.from, false);
    try {
      await conn.handleSignal(message.kind, message.payload);
    } catch {
      /* recoverable negotiation error */
    }
  }

  /* ---------------- transfers: state helpers ---------------- */

  private updateTransfer(id: string, partial: Partial<Transfer>, immediate = true): void {
    const transfers = this.state.transfers.map((t) => (t.id === id ? { ...t, ...partial } : t));
    this.patch({ transfers }, immediate);
  }

  private updateFile(tid: string, fid: string, partial: Partial<TransferFile>, immediate = true): void {
    const transfers = this.state.transfers.map((t) => {
      if (t.id !== tid) return t;
      const files = t.files.map((f) => (f.meta.fid === fid ? { ...f, ...partial } : f));
      const transferred = files.reduce((sum, f) => sum + f.transferred, 0);
      return { ...t, files, transferred };
    });
    this.patch({ transfers }, immediate);
  }

  getTransfer(id: string): Transfer | undefined {
    return this.state.transfers.find((t) => t.id === id);
  }

  private trackSpeed(tid: string, transferred: number, total: number): void {
    const now = performance.now();
    const previous = this.speedTrack.get(tid) ?? { bytes: transferred, at: now, speed: 0 };
    const elapsed = (now - previous.at) / 1000;
    if (elapsed >= 0.35) {
      const instant = (transferred - previous.bytes) / elapsed;
      const speed = previous.speed === 0 ? instant : previous.speed * 0.7 + instant * 0.3;
      this.speedTrack.set(tid, { bytes: transferred, at: now, speed });
      const remaining = Math.max(0, total - transferred);
      this.updateTransfer(tid, { speed, eta: speed > 1 ? remaining / speed : null }, false);
    }
  }

  private finishTransfer(tid: string, status: Transfer["status"], error?: string): void {
    const transfer = this.getTransfer(tid);
    if (!transfer) return;
    const verified = transfer.files.length > 0 && transfer.files.every((f) => f.verified);
    this.updateTransfer(tid, {
      status,
      error,
      endedAt: Date.now(),
      verified: status === "done" ? verified : false,
      speed: 0,
      eta: null,
      currentFid: undefined,
    });
    const entry: HistoryEntry = {
      id: tid,
      name:
        transfer.kind === "text"
          ? "Text message"
          : transfer.files.length === 1
            ? (transfer.files[0]?.meta.name ?? "File")
            : `${transfer.files.length} files`,
      size: transfer.totalSize,
      at: Date.now(),
      direction: transfer.direction,
      deviceName: transfer.peer.name,
      deviceId: transfer.peer.id,
      status:
        status === "done"
          ? "completed"
          : status === "cancelled"
            ? "cancelled"
            : status === "declined"
              ? "declined"
              : "failed",
      kind: transfer.kind,
      fileCount: transfer.files.length,
      verified: status === "done" ? verified : false,
    };
    this.patch({ history: appendHistory(entry) });
    const { settings } = this.state;
    if (status === "done") {
      playSuccessSound(settings.sounds);
      vibrate(settings.haptics, [30, 40, 30]);
      notify(
        settings.notifications,
        transfer.direction === "send" ? "Transfer complete" : "Transfer received",
        `${entry.name} ${transfer.direction === "send" ? "sent to" : "received from"} ${transfer.peer.name}`,
      );
    } else if (status === "failed") {
      playErrorSound(settings.sounds);
      notify(settings.notifications, "Transfer failed", error ?? "The transfer did not complete.");
    }
  }

  /* ---------------- sending ---------------- */

  async sendFiles(items: OutgoingItem[], deviceIds: string[]): Promise<string[]> {
    if (items.length === 0) throw new Error("Select at least one file to send.");
    if (deviceIds.length === 0) throw new Error("Select at least one device.");
    const ids: string[] = [];
    for (const deviceId of deviceIds) {
      ids.push(await this.startSend(items, deviceId, "files"));
    }
    return ids;
  }

  async sendText(text: string, deviceIds: string[]): Promise<string[]> {
    if (!text.trim()) throw new Error("Type something to send.");
    const ids: string[] = [];
    for (const deviceId of deviceIds) {
      ids.push(await this.startSend([], deviceId, "text", text));
    }
    return ids;
  }

  private async startSend(
    items: OutgoingItem[],
    deviceId: string,
    kind: "files" | "text",
    text?: string,
  ): Promise<string> {
    const record = this.getOrCreatePeer(deviceId);
    const tid = randomId(16);
    const metas: FileMeta[] = items.map((item) => ({
      fid: randomId(10),
      name: item.file.name,
      path: item.path || item.file.name,
      size: item.file.size,
      mime: item.file.type || "application/octet-stream",
      chunkSize: CHUNK_SIZE,
      chunks: Math.max(1, Math.ceil(item.file.size / CHUNK_SIZE)),
    }));
    const runtime: SendRuntime = {
      items: new Map(metas.map((meta, index) => [meta.fid, items[index]!])),
      paused: false,
      cancelled: false,
      resumeWaiters: [],
      resumeFrom: new Map(),
      ackWaiters: new Map(),
    };
    this.sendRuntimes.set(tid, runtime);
    const totalSize = metas.reduce((sum, m) => sum + m.size, 0);
    const transfer: Transfer = {
      id: tid,
      direction: "send",
      peer: record.info,
      kind,
      text,
      files: metas.map((meta) => ({
        meta,
        transferred: 0,
        status: "waiting",
        verified: false,
        saved: false,
      })),
      totalSize,
      transferred: 0,
      status: "awaiting-approval",
      speed: 0,
      eta: null,
      verified: false,
      createdAt: Date.now(),
      writtenToDisk: false,
    };
    this.patch({ transfers: [transfer, ...this.state.transfers] });

    void (async () => {
      try {
        const conn = await this.ensureConnected(deviceId);
        conn.sendControl({ t: "offer", tid, kind, text, files: metas, totalSize });
      } catch (error) {
        this.finishTransfer(tid, "failed", (error as Error).message);
      }
    })();
    return tid;
  }

  private async runSend(tid: string): Promise<void> {
    const runtime = this.sendRuntimes.get(tid);
    const transfer = this.getTransfer(tid);
    if (!runtime || !transfer) return;
    const conn = this.peers.get(transfer.peer.id)?.conn;
    if (!conn?.isOpen) {
      this.updateTransfer(tid, { status: "interrupted", error: "Connection lost." });
      return;
    }
    this.updateTransfer(tid, { status: "active", error: undefined });
    this.speedTrack.delete(tid);

    try {
      for (const file of transfer.files) {
        const current = this.getTransfer(tid)?.files.find((f) => f.meta.fid === file.meta.fid);
        if (current?.status === "done") continue;
        await this.sendOneFile(tid, file.meta);
        if (runtime.cancelled) break;
      }
      if (runtime.cancelled) return;
      const finalTransfer = this.getTransfer(tid);
      const allDone = finalTransfer?.files.every((f) => f.status === "done") ?? false;
      conn.sendControl({ t: "complete", tid });
      this.finishTransfer(tid, allDone ? "done" : "failed", allDone ? undefined : "Some files failed.");
      this.sendRuntimes.delete(tid);
    } catch (error) {
      const message = (error as Error).message;
      if (message === "cancelled") return;
      this.updateTransfer(tid, { status: "interrupted", error: message });
    }
  }

  private async sendOneFile(tid: string, meta: FileMeta): Promise<void> {
    const runtime = this.sendRuntimes.get(tid)!;
    const transfer = this.getTransfer(tid)!;
    const conn = this.peers.get(transfer.peer.id)?.conn;
    if (!conn?.isOpen) throw new Error("Connection interrupted. Attempting to reconnect…");
    const item = runtime.items.get(meta.fid);
    if (!item) throw new Error("File is no longer available on this device.");

    this.updateTransfer(tid, { currentFid: meta.fid });
    this.updateFile(tid, meta.fid, { status: "active" });

    const startChunk = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The receiver did not respond in time.")), 20000);
      runtime.resumeFrom.set(meta.fid, (chunk) => {
        clearTimeout(timer);
        resolve(chunk);
      });
      conn.sendControl({ t: "file-start", tid, fid: meta.fid });
    });

    const hashes: string[] = [];
    const verify = this.state.settings.verifyTransfers;
    let transferred = startChunk * meta.chunkSize;
    this.updateFile(tid, meta.fid, { transferred }, false);

    for (let i = 0; i < meta.chunks; i += 1) {
      if (runtime.cancelled) throw new Error("cancelled");
      while (runtime.paused) {
        await new Promise<void>((resolve) => runtime.resumeWaiters.push(resolve));
        if (runtime.cancelled) throw new Error("cancelled");
      }
      const start = i * meta.chunkSize;
      const end = Math.min(meta.size, start + meta.chunkSize);
      const buffer = await item.file.slice(start, end).arrayBuffer();
      const hash = verify ? await sha256(buffer) : "";
      hashes.push(hash);
      if (i < startChunk) continue;
      if (!conn.isOpen) throw new Error("Connection interrupted. Attempting to reconnect…");
      conn.sendControl({ t: "chunk", tid, fid: meta.fid, i, hash, size: buffer.byteLength });
      conn.sendBinary(buffer);
      await conn.waitForDrain();
      transferred = end;
      this.updateFile(tid, meta.fid, { transferred }, false);
      this.trackSpeed(tid, this.getTransfer(tid)?.transferred ?? transferred, transfer.totalSize);
    }

    const fileHash = verify ? await sha256OfHashes(hashes) : "";
    const ack = await new Promise<{ ok: boolean; reason?: string | undefined }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The receiver did not confirm the file.")), 30000);
      runtime.ackWaiters.set(meta.fid, (ok, reason) => {
        clearTimeout(timer);
        resolve({ ok, reason });
      });
      conn.sendControl({ t: "file-end", tid, fid: meta.fid, hash: fileHash });
    });

    if (ack.ok) {
      this.updateFile(tid, meta.fid, { status: "done", verified: verify, transferred: meta.size });
    } else {
      this.updateFile(tid, meta.fid, {
        status: "failed",
        error: ack.reason ?? "Transfer failed integrity check.",
      });
      throw new Error(ack.reason ?? "Transfer failed integrity check.");
    }
  }

  pauseTransfer(tid: string): void {
    const runtime = this.sendRuntimes.get(tid);
    if (!runtime) return;
    runtime.paused = true;
    this.updateTransfer(tid, { status: "paused" });
  }

  resumeTransfer(tid: string): void {
    const runtime = this.sendRuntimes.get(tid);
    if (runtime) {
      runtime.paused = false;
      const waiters = runtime.resumeWaiters.splice(0);
      for (const waiter of waiters) waiter();
      this.updateTransfer(tid, { status: "active" });
      return;
    }
    const transfer = this.getTransfer(tid);
    if (transfer?.direction === "send" && transfer.status === "interrupted") {
      void this.retryTransfer(tid);
    }
  }

  async retryTransfer(tid: string): Promise<void> {
    const transfer = this.getTransfer(tid);
    if (!transfer || transfer.direction !== "send") return;
    if (!this.sendRuntimes.has(tid)) {
      this.updateTransfer(tid, { status: "failed", error: "Re-select the files to send them again." });
      return;
    }
    try {
      await this.ensureConnected(transfer.peer.id);
      await this.runSend(tid);
    } catch (error) {
      this.updateTransfer(tid, { status: "failed", error: (error as Error).message });
    }
  }

  cancelTransfer(tid: string): void {
    const transfer = this.getTransfer(tid);
    if (!transfer) return;
    const runtime = this.sendRuntimes.get(tid);
    if (runtime) {
      runtime.cancelled = true;
      runtime.paused = false;
      for (const waiter of runtime.resumeWaiters.splice(0)) waiter();
      this.sendRuntimes.delete(tid);
    }
    const receive = this.receiveRuntimes.get(tid);
    if (receive) {
      for (const sink of receive.sinks.values()) void sink.abort();
      this.receiveRuntimes.delete(tid);
    }
    const conn = this.peers.get(transfer.peer.id)?.conn;
    try {
      conn?.sendControl({ t: "cancel", tid });
    } catch {
      /* peer already gone */
    }
    this.finishTransfer(tid, "cancelled");
  }

  private async resumeInterrupted(peerId: string): Promise<void> {
    for (const transfer of this.state.transfers) {
      if (transfer.peer.id === peerId && transfer.status === "interrupted" && transfer.direction === "send") {
        if (this.sendRuntimes.has(transfer.id)) void this.runSend(transfer.id);
      }
    }
  }

  /* ---------------- receiving ---------------- */

  private async handleControl(peerId: string, message: Control): Promise<void> {
    switch (message.t) {
      case "offer":
        this.handleIncomingOffer(peerId, message);
        break;
      case "accept": {
        const runtime = this.sendRuntimes.get(message.tid);
        if (runtime) void this.runSend(message.tid);
        break;
      }
      case "decline":
        this.sendRuntimes.delete(message.tid);
        this.finishTransfer(message.tid, "declined", "The other device declined this transfer.");
        break;
      case "file-start":
        await this.handleFileStart(peerId, message.tid, message.fid);
        break;
      case "chunk": {
        const runtime = this.receiveRuntimes.get(message.tid);
        if (runtime) runtime.pending = { fid: message.fid, i: message.i, hash: message.hash, size: message.size };
        break;
      }
      case "file-end":
        await this.handleFileEnd(peerId, message.tid, message.fid, message.hash);
        break;
      case "resume-from": {
        const runtime = this.sendRuntimes.get(message.tid);
        runtime?.resumeFrom.get(message.fid)?.(message.chunk);
        runtime?.resumeFrom.delete(message.fid);
        break;
      }
      case "file-ack": {
        const runtime = this.sendRuntimes.get(message.tid);
        runtime?.ackWaiters.get(message.fid)?.(message.ok, message.reason);
        runtime?.ackWaiters.delete(message.fid);
        break;
      }
      case "complete": {
        const transfer = this.getTransfer(message.tid);
        if (transfer && transfer.direction === "receive" && transfer.status === "active") {
          const allDone = transfer.files.every((f) => f.status === "done");
          this.finishTransfer(message.tid, allDone ? "done" : "failed", allDone ? undefined : "Some files failed.");
          this.receiveRuntimes.delete(message.tid);
        }
        break;
      }
      case "cancel": {
        const receive = this.receiveRuntimes.get(message.tid);
        if (receive) {
          for (const sink of receive.sinks.values()) void sink.abort();
          this.receiveRuntimes.delete(message.tid);
        }
        this.sendRuntimes.delete(message.tid);
        if (this.getTransfer(message.tid)) this.finishTransfer(message.tid, "cancelled", "The other device cancelled.");
        break;
      }
    }
  }

  private handleIncomingOffer(peerId: string, message: Extract<Control, { t: "offer" }>): void {
    const record = this.getOrCreatePeer(peerId);
    const known = this.state.settings.knownDevices[peerId];
    if (known?.blocked) {
      record.conn?.sendControl({ t: "decline", tid: message.tid });
      return;
    }
    const transfer: Transfer = {
      id: message.tid,
      direction: "receive",
      peer: record.info,
      kind: message.kind,
      text: message.text,
      files: message.files.map((meta) => ({
        meta,
        transferred: 0,
        status: "waiting",
        verified: false,
        saved: false,
      })),
      totalSize: message.totalSize,
      transferred: 0,
      status: "awaiting-approval",
      speed: 0,
      eta: null,
      verified: false,
      createdAt: Date.now(),
      writtenToDisk: false,
    };
    this.patch({ transfers: [transfer, ...this.state.transfers] });
    const { settings } = this.state;
    playIncomingSound(settings.sounds);
    vibrate(settings.haptics, [20, 30, 20]);
    notify(
      settings.notifications,
      "Incoming transfer",
      `${record.info.name} wants to send ${message.kind === "text" ? "text" : `${message.files.length} file(s)`}`,
    );

    const autoAccept = !settings.askBeforeReceiving || (settings.autoAcceptTrusted && !!known?.trusted);
    if (autoAccept) void this.respondToTransfer(message.tid, true);
  }

  async respondToTransfer(tid: string, accept: boolean): Promise<void> {
    const transfer = this.getTransfer(tid);
    if (!transfer || transfer.direction !== "receive") return;
    const conn = this.peers.get(transfer.peer.id)?.conn;
    if (!conn?.isOpen) {
      this.finishTransfer(tid, "failed", "The sending device disconnected.");
      return;
    }
    if (!accept) {
      conn.sendControl({ t: "decline", tid });
      this.finishTransfer(tid, "declined");
      return;
    }
    if (transfer.kind === "text") {
      conn.sendControl({ t: "accept", tid });
      const text: ReceivedText = {
        id: tid,
        from: transfer.peer,
        text: transfer.text ?? "",
        at: Date.now(),
      };
      this.patch({ texts: [text, ...this.state.texts].slice(0, 50) });
      this.updateTransfer(tid, { status: "active" });
      conn.sendControl({ t: "complete", tid });
      this.finishTransfer(tid, "done");
      return;
    }
    this.receiveRuntimes.set(tid, {
      sinks: new Map(),
      received: new Map(),
      hashes: new Map(),
      pending: null,
      files: new Map(),
    });
    this.speedTrack.delete(tid);
    this.updateTransfer(tid, { status: "active", writtenToDisk: !!this.downloadDir });
    conn.sendControl({ t: "accept", tid });
  }

  private async handleFileStart(peerId: string, tid: string, fid: string): Promise<void> {
    const runtime = this.receiveRuntimes.get(tid);
    const transfer = this.getTransfer(tid);
    const conn = this.peers.get(peerId)?.conn;
    if (!runtime || !transfer || !conn) return;
    const meta = transfer.files.find((f) => f.meta.fid === fid)?.meta;
    if (!meta) return;
    this.updateTransfer(tid, { currentFid: fid });
    this.updateFile(tid, fid, { status: "active" });

    let alreadyHave = runtime.received.get(fid) ?? 0;
    if (!runtime.sinks.has(fid)) {
      alreadyHave = 0;
      runtime.received.set(fid, 0);
      runtime.hashes.set(fid, []);
      let sink: FileSink;
      if (this.downloadDir) {
        try {
          sink = await createDiskSink(
            this.downloadDir,
            this.receivePath(transfer, meta),
            this.state.settings.preserveFolderStructure,
          );
        } catch {
          sink = createMemorySink();
        }
      } else {
        sink = createMemorySink();
      }
      runtime.sinks.set(fid, sink);
    }
    conn.sendControl({ t: "resume-from", tid, fid, chunk: alreadyHave });
  }

  private receivePath(transfer: Transfer, meta: FileMeta): string {
    const day = new Date().toISOString().slice(0, 10);
    const relative = this.state.settings.preserveFolderStructure ? meta.path : meta.name;
    return `LocalSend/${day}/${relative}`;
  }

  private async handleBinary(peerId: string, data: ArrayBuffer): Promise<void> {
    const record = this.peers.get(peerId);
    if (!record) return;
    for (const [tid, runtime] of this.receiveRuntimes) {
      const transfer = this.getTransfer(tid);
      if (!transfer || transfer.peer.id !== peerId || !runtime.pending) continue;
      const pending = runtime.pending;
      runtime.pending = null;
      const conn = record.conn;
      if (this.state.settings.verifyTransfers && pending.hash) {
        const hash = await sha256(data);
        if (hash !== pending.hash) {
          this.updateFile(tid, pending.fid, { status: "failed", error: "Chunk failed integrity check." });
          conn?.sendControl({
            t: "file-ack",
            tid,
            fid: pending.fid,
            ok: false,
            reason: "Transfer failed integrity check.",
          });
          return;
        }
        runtime.hashes.get(pending.fid)?.push(hash);
      } else {
        runtime.hashes.get(pending.fid)?.push("");
      }
      const sink = runtime.sinks.get(pending.fid);
      if (!sink) return;
      await sink.write(data);
      const count = (runtime.received.get(pending.fid) ?? 0) + 1;
      runtime.received.set(pending.fid, count);
      const meta = transfer.files.find((f) => f.meta.fid === pending.fid)?.meta;
      const transferred = Math.min(meta?.size ?? 0, count * (meta?.chunkSize ?? data.byteLength));
      this.updateFile(tid, pending.fid, { transferred }, false);
      this.trackSpeed(tid, this.getTransfer(tid)?.transferred ?? transferred, transfer.totalSize);
      return;
    }
  }

  private async handleFileEnd(peerId: string, tid: string, fid: string, hash: string): Promise<void> {
    const runtime = this.receiveRuntimes.get(tid);
    const transfer = this.getTransfer(tid);
    const conn = this.peers.get(peerId)?.conn;
    if (!runtime || !transfer || !conn) return;
    const meta = transfer.files.find((f) => f.meta.fid === fid)?.meta;
    const sink = runtime.sinks.get(fid);
    if (!meta || !sink) return;

    const verify = this.state.settings.verifyTransfers && !!hash;
    if (verify) {
      const localHash = await sha256OfHashes(runtime.hashes.get(fid) ?? []);
      if (localHash !== hash) {
        await sink.abort();
        runtime.sinks.delete(fid);
        this.updateFile(tid, fid, { status: "failed", error: "Transfer failed integrity check." });
        conn.sendControl({ t: "file-ack", tid, fid, ok: false, reason: "Transfer failed integrity check." });
        return;
      }
    }
    const blob = await sink.finish();
    runtime.sinks.delete(fid);
    runtime.files.set(fid, {
      fid,
      name: meta.name,
      path: meta.path,
      mime: meta.mime,
      size: meta.size,
      blob,
      writtenToDisk: blob === null,
    });
    this.updateFile(tid, fid, {
      status: "done",
      verified: verify,
      transferred: meta.size,
      saved: blob === null,
    });
    conn.sendControl({ t: "file-ack", tid, fid, ok: true });
  }

  getReceivedFiles(tid: string): ReceivedFile[] {
    const runtime = this.receiveRuntimes.get(tid);
    if (runtime) return Array.from(runtime.files.values());
    const kept = this.keptFiles.get(tid);
    return kept ?? [];
  }

  private keptFiles = new Map<string, ReceivedFile[]>();

  /** Keep received blobs available after the runtime is torn down. */
  private preserveReceived(tid: string): void {
    const runtime = this.receiveRuntimes.get(tid);
    if (runtime) this.keptFiles.set(tid, Array.from(runtime.files.values()));
  }

  /* ---------------- destination folder ---------------- */

  async chooseDownloadFolder(): Promise<void> {
    const picker = (window as Window & {
      showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    if (!picker) throw new Error("This browser can't pick a folder. Files will be offered as downloads instead.");
    const handle = await picker({ mode: "readwrite" });
    this.downloadDir = handle;
    await saveDirectoryHandle(handle);
    this.patch({ downloadFolder: handle.name });
  }

  async clearDownloadFolder(): Promise<void> {
    this.downloadDir = null;
    await saveDirectoryHandle(null);
    this.patch({ downloadFolder: null });
  }

  /* ---------------- text + housekeeping ---------------- */

  dismissText(id: string): void {
    this.patch({ texts: this.state.texts.filter((t) => t.id !== id) });
  }

  dismissTransfer(id: string): void {
    this.preserveReceived(id);
    this.receiveRuntimes.delete(id);
    this.patch({ transfers: this.state.transfers.filter((t) => t.id !== id) });
  }

  clearHistoryEntries(): void {
    clearHistory();
    this.patch({ history: [] });
  }

  clearDeviceData(): void {
    this.updateSettings({ knownDevices: {} });
    this.refreshPeers();
  }

  async resetEverything(): Promise<void> {
    clearHistory();
    clearSettings();
    clearIdentity();
    await saveDirectoryHandle(null);
    await this.signaling.leave();
    for (const record of this.peers.values()) record.conn?.close();
    this.peers.clear();
    window.location.reload();
  }
}

let engine: LocalSendEngine | null = null;

export function getEngine(): LocalSendEngine {
  engine ??= new LocalSendEngine();
  return engine;
}
