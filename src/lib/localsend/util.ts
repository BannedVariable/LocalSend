import type { DeviceType } from "./types";

export const CHUNK_SIZE = 64 * 1024;

export function randomId(len = 12): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, len);
}

export function numericCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const n = (bytes[0]! % 900000) + 100000;
  return String(n);
}

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 1) return "less than a second";
  if (seconds < 60) return `${Math.round(seconds)} second${Math.round(seconds) === 1 ? "" : "s"}`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export async function sha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer =
    data instanceof Uint8Array
      ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
      : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256OfHashes(hashes: string[]): Promise<string> {
  return sha256(new TextEncoder().encode(hashes.join("")));
}

/** Detect platform + best-guess device type from the user agent / UA-CH. */
export function detectDevice(): { type: DeviceType; os: string } {
  if (typeof navigator === "undefined") return { type: "unknown", os: "Unknown" };
  const ua = navigator.userAgent;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } })
    .userAgentData;
  const platform = uaData?.platform ?? "";
  let os = "Unknown";
  if (/iPhone/i.test(ua)) os = "iOS";
  else if (/iPad/i.test(ua)) os = "iPadOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac/i.test(ua) || /macOS/i.test(platform)) os = "macOS";
  else if (/Win/i.test(ua) || /Windows/i.test(platform)) os = "Windows";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  const touchPoints = navigator.maxTouchPoints ?? 0;
  let type: DeviceType = "unknown";
  if (os === "iPadOS" || (/Tablet|Android/i.test(ua) && !/Mobile/i.test(ua))) type = "tablet";
  else if (os === "iOS" || os === "Android" || uaData?.mobile) type = "phone";
  else if (os === "macOS" || os === "ChromeOS") type = "laptop";
  else if (os === "Windows" || os === "Linux") type = touchPoints > 0 ? "laptop" : "desktop";
  return { type, os };
}

export function defaultDeviceName(type: DeviceType, os: string): string {
  const label: Record<DeviceType, string> = {
    desktop: "PC",
    laptop: "Laptop",
    phone: "Phone",
    tablet: "Tablet",
    unknown: "Device",
  };
  return `${os === "Unknown" ? "My" : os} ${label[type]}`;
}

export interface Capabilities {
  webrtc: boolean;
  dataChannel: boolean;
  fileSystemAccess: boolean;
  directoryPicker: boolean;
  clipboardRead: boolean;
  clipboardWrite: boolean;
  notifications: boolean;
  vibration: boolean;
  webShareTarget: boolean;
  crypto: boolean;
  streams: boolean;
}

export function detectCapabilities(): Capabilities {
  const w = typeof window === "undefined" ? undefined : window;
  return {
    webrtc: !!w && "RTCPeerConnection" in w,
    dataChannel: !!w && "RTCPeerConnection" in w,
    fileSystemAccess: !!w && "showSaveFilePicker" in w,
    directoryPicker: !!w && "showDirectoryPicker" in w,
    clipboardRead: !!(typeof navigator !== "undefined" && navigator.clipboard?.readText),
    clipboardWrite: !!(typeof navigator !== "undefined" && navigator.clipboard?.writeText),
    notifications: !!w && "Notification" in w,
    vibration: typeof navigator !== "undefined" && "vibrate" in navigator,
    webShareTarget: !!w && "serviceWorker" in navigator,
    crypto: typeof crypto !== "undefined" && !!crypto.subtle,
    streams: !!w && "WritableStream" in w,
  };
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE);
  return matches ? Array.from(new Set(matches)) : [];
}

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
