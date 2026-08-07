import type { OutgoingItem } from "./engine";

let pending: OutgoingItem[] = [];
let pendingText: string | null = null;
let pendingDeviceId: string | null = null;

export function setPendingItems(items: OutgoingItem[]): void {
  pending = items;
}

export function takePendingItems(): OutgoingItem[] {
  const items = pending;
  pending = [];
  return items;
}

export function setPendingText(text: string | null): void {
  pendingText = text;
}

export function takePendingText(): string | null {
  const text = pendingText;
  pendingText = null;
  return text;
}

export function setPendingDevice(id: string | null): void {
  pendingDeviceId = id;
}

export function takePendingDevice(): string | null {
  const id = pendingDeviceId;
  pendingDeviceId = null;
  return id;
}
