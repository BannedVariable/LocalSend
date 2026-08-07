import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getEngine } from "./engine";
import type { EngineState, LocalSendEngine } from "./engine";

const serverSnapshot: EngineState = {
  hydrated: false,
  identity: { id: "", name: "This device", type: "unknown", os: "Unknown", onboarded: false },
  settings: {
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
  },
  status: "connecting",
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

export function useLocalSend(): { state: EngineState; engine: LocalSendEngine } {
  const engine = getEngine();
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, () => serverSnapshot);

  useEffect(() => {
    void engine.start();
  }, [engine]);

  useEffect(() => {
    const theme = state.settings.theme;
    const root = document.documentElement;
    const apply = (dark: boolean) => root.classList.toggle("dark", dark);
    if (theme === "system") {
      const query = window.matchMedia("(prefers-color-scheme: dark)");
      apply(query.matches);
      const listener = (event: MediaQueryListEvent) => apply(event.matches);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    }
    apply(theme === "dark");
    return undefined;
  }, [state.settings.theme]);

  return { state, engine };
}

/** Collect files from a drag-and-drop event, including dropped directories. */
export function useDropFiles(
  onFiles: (items: { file: File; path: string }[]) => void,
): {
  dragging: boolean;
  handlers: {
    onDragOver: (event: React.DragEvent) => void;
    onDragLeave: (event: React.DragEvent) => void;
    onDrop: (event: React.DragEvent) => void;
  };
} {
  const [dragging, setDragging] = useDragState();

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const items = await readDataTransfer(event.dataTransfer);
      if (items.length > 0) onFiles(items);
    },
    [onFiles, setDragging],
  );

  return {
    dragging,
    handlers: {
      onDragOver: (event) => {
        event.preventDefault();
        setDragging(true);
      },
      onDragLeave: () => setDragging(false),
      onDrop: (event) => void onDrop(event),
    },
  };
}

import { useState } from "react";

function useDragState(): [boolean, (value: boolean) => void] {
  const [dragging, setDragging] = useState(false);
  return [dragging, setDragging];
}

interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (cb: (file: File) => void, err?: (e: unknown) => void) => void;
  createReader: () => { readEntries: (cb: (entries: FsEntry[]) => void) => void };
}

async function walkEntry(entry: FsEntry, prefix: string): Promise<{ file: File; path: string }[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
    return [{ file, path: prefix + entry.name }];
  }
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const collected: { file: File; path: string }[] = [];
  let batch: FsEntry[] = [];
  do {
    batch = await new Promise<FsEntry[]>((resolve) => reader.readEntries(resolve));
    for (const child of batch) {
      collected.push(...(await walkEntry(child, `${prefix}${entry.name}/`)));
    }
  } while (batch.length > 0);
  return collected;
}

export async function readDataTransfer(
  dataTransfer: DataTransfer,
): Promise<{ file: File; path: string }[]> {
  const results: { file: File; path: string }[] = [];
  const entries: FsEntry[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    const asEntry = (item as DataTransferItem)
      .webkitGetAsEntry?.() as unknown as FsEntry | null;
    if (asEntry) entries.push(asEntry);
  }
  if (entries.length > 0) {
    for (const entry of entries) results.push(...(await walkEntry(entry, "")));
    if (results.length > 0) return results;
  }
  for (const file of Array.from(dataTransfer.files)) {
    results.push({ file, path: file.name });
  }
  return results;
}
