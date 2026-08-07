import type { DeviceType } from "./types";
import { detectDevice, defaultDeviceName, randomId } from "./util";

const IDENTITY_KEY = "localsend.identity.v1";
const SETTINGS_KEY = "localsend.settings.v1";

export interface Identity {
  id: string;
  name: string;
  type: DeviceType;
  os: string;
  onboarded: boolean;
}

export interface KnownDevice {
  id: string;
  name: string;
  type: DeviceType;
  os: string;
  lastSeen: number;
  trusted: boolean;
  blocked: boolean;
  favorite: boolean;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  askBeforeReceiving: boolean;
  autoAcceptTrusted: boolean;
  preserveFolderStructure: boolean;
  verifyTransfers: boolean;
  notifications: boolean;
  sounds: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  roomOverride: string | null;
  roomOverrideAt: number | null;
  sessionMinutes: number;
  knownDevices: Record<string, KnownDevice>;
}

export const defaultSettings: Settings = {
  theme: "system",
  askBeforeReceiving: true,
  autoAcceptTrusted: false,
  preserveFolderStructure: true,
  verifyTransfers: true,
  notifications: true,
  sounds: true,
  haptics: true,
  reducedMotion: false,
  roomOverride: null,
  roomOverrideAt: null,
  sessionMinutes: 60,
  knownDevices: {},
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export function loadIdentity(): Identity {
  const detected = detectDevice();
  const fallback: Identity = {
    id: randomId(16),
    name: defaultDeviceName(detected.type, detected.os),
    type: detected.type,
    os: detected.os,
    onboarded: false,
  };
  if (typeof localStorage === "undefined") return fallback;
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (!stored) {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(fallback));
    return fallback;
  }
  return safeParse(stored, fallback);
}

export function saveIdentity(identity: Identity): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return defaultSettings;
  return safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearIdentity(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(IDENTITY_KEY);
}

export function clearSettings(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SETTINGS_KEY);
}
