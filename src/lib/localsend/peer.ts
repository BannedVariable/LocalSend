import type { Control } from "./types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
];

export interface PeerHandlers {
  onSignal: (kind: "offer" | "answer" | "ice", payload: unknown) => void;
  onControl: (message: Control) => void;
  onBinary: (data: ArrayBuffer) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
  onOpen: () => void;
  onClose: () => void;
}

const LOW_WATERMARK = 1 * 1024 * 1024;
const HIGH_WATERMARK = 8 * 1024 * 1024;

/**
 * One encrypted WebRTC peer connection (DTLS/SRTP is mandatory in WebRTC, so
 * every byte on the data channel is encrypted in transit) plus a single
 * reliable, ordered data channel used for both control JSON and file chunks.
 */
export class PeerConnection {
  readonly pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private readonly handlers: PeerHandlers;
  readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;

  constructor(handlers: PeerHandlers, polite: boolean) {
    this.handlers = handlers;
    this.polite = polite;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) handlers.onSignal("ice", event.candidate.toJSON());
    };
    this.pc.onconnectionstatechange = () => {
      handlers.onStateChange(this.pc.connectionState);
      if (this.pc.connectionState === "failed" || this.pc.connectionState === "closed") {
        handlers.onClose();
      }
    };
    this.pc.ondatachannel = (event) => this.attachChannel(event.channel);
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) handlers.onSignal("offer", this.pc.localDescription.toJSON());
      } catch {
        /* renegotiation races are recovered by the perfect-negotiation logic */
      } finally {
        this.makingOffer = false;
      }
    };
  }

  createChannel(): void {
    if (this.channel) return;
    this.attachChannel(this.pc.createDataChannel("localsend", { ordered: true }));
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = LOW_WATERMARK;
    channel.onopen = () => this.handlers.onOpen();
    channel.onclose = () => this.handlers.onClose();
    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          this.handlers.onControl(JSON.parse(event.data) as Control);
        } catch {
          /* ignore malformed control frames */
        }
      } else {
        this.handlers.onBinary(event.data as ArrayBuffer);
      }
    };
  }

  get isOpen(): boolean {
    return this.channel?.readyState === "open";
  }

  sendControl(message: Control): void {
    if (!this.isOpen) throw new Error("Connection is not open");
    this.channel!.send(JSON.stringify(message));
  }

  sendBinary(data: ArrayBuffer): void {
    if (!this.isOpen) throw new Error("Connection is not open");
    this.channel!.send(data);
  }

  /** Backpressure: resolve once the outgoing buffer has drained enough. */
  async waitForDrain(): Promise<void> {
    const channel = this.channel;
    if (!channel || channel.bufferedAmount < HIGH_WATERMARK) return;
    await new Promise<void>((resolve) => {
      const onLow = () => {
        channel.removeEventListener("bufferedamountlow", onLow);
        resolve();
      };
      channel.addEventListener("bufferedamountlow", onLow);
      setTimeout(onLow, 4000);
    });
  }

  async handleSignal(kind: "offer" | "answer" | "ice", payload: unknown): Promise<void> {
    if (kind === "ice") {
      try {
        await this.pc.addIceCandidate(payload as RTCIceCandidateInit);
      } catch {
        /* candidates can arrive before the remote description; safe to drop */
      }
      return;
    }
    const description = payload as RTCSessionDescriptionInit;
    const offerCollision =
      description.type === "offer" && (this.makingOffer || this.pc.signalingState !== "stable");
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;
    await this.pc.setRemoteDescription(description);
    if (description.type === "offer") {
      await this.pc.setLocalDescription();
      if (this.pc.localDescription) this.handlers.onSignal("answer", this.pc.localDescription.toJSON());
    }
  }

  close(): void {
    try {
      this.channel?.close();
    } catch {
      /* already closed */
    }
    try {
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}
