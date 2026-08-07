export type DeviceType = "desktop" | "laptop" | "phone" | "tablet" | "unknown";

export interface DeviceInfo {
  id: string;
  name: string;
  type: DeviceType;
  os: string;
  joinedAt: number;
}

export type PeerConnState = "idle" | "connecting" | "connected" | "reconnecting" | "failed";

export interface Peer {
  info: DeviceInfo;
  conn: PeerConnState;
  lastSeen: number;
}

export interface FileMeta {
  fid: string;
  name: string;
  /** relative path including name, e.g. "vacation/beach.jpg" */
  path: string;
  size: number;
  mime: string;
  chunks: number;
  chunkSize: number;
}

export type FileStatus = "waiting" | "active" | "done" | "failed" | "cancelled";

export interface TransferFile {
  meta: FileMeta;
  transferred: number;
  status: FileStatus;
  verified: boolean;
  /** receiver-side: object URL available for saving */
  saved: boolean;
  error?: string | undefined;
}

export type TransferStatus =
  | "awaiting-approval"
  | "declined"
  | "active"
  | "paused"
  | "interrupted"
  | "done"
  | "failed"
  | "cancelled";

export interface Transfer {
  id: string;
  direction: "send" | "receive";
  peer: DeviceInfo;
  kind: "files" | "text";
  text?: string | undefined;
  files: TransferFile[];
  totalSize: number;
  transferred: number;
  status: TransferStatus;
  speed: number;
  eta: number | null;
  verified: boolean;
  error?: string | undefined;
  currentFid?: string | undefined;
  createdAt: number;
  endedAt?: number | undefined;
  /** receiver: files were streamed straight to a chosen folder */
  writtenToDisk: boolean;
}

export interface HistoryEntry {
  id: string;
  name: string;
  size: number;
  at: number;
  direction: "send" | "receive";
  deviceName: string;
  deviceId: string;
  status: "completed" | "failed" | "cancelled" | "declined";
  kind: "files" | "text";
  fileCount: number;
  verified: boolean;
}

export type NetworkStatus = "offline" | "connecting" | "ready";

/* ---------- wire protocol (over WebRTC DataChannel) ---------- */

export type Control =
  | {
      t: "offer";
      tid: string;
      kind: "files" | "text";
      text?: string | undefined;
      files: FileMeta[];
      totalSize: number;
    }
  | { t: "accept"; tid: string }
  | { t: "decline"; tid: string }
  | { t: "file-start"; tid: string; fid: string }
  | { t: "chunk"; tid: string; fid: string; i: number; hash: string; size: number }
  | { t: "file-end"; tid: string; fid: string; hash: string }
  | { t: "file-ack"; tid: string; fid: string; ok: boolean; reason?: string | undefined }
  | { t: "resume-from"; tid: string; fid: string; chunk: number }
  | { t: "complete"; tid: string }
  | { t: "cancel"; tid: string; reason?: string | undefined };

export interface SignalMessage {
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice";
  payload: unknown;
  device?: DeviceInfo;
}
