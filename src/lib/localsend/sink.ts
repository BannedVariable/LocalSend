export interface FileSink {
  write(chunk: ArrayBuffer): Promise<void>;
  finish(): Promise<Blob | null>;
  abort(): Promise<void>;
}

export function createMemorySink(): FileSink {
  let parts: BlobPart[] = [];
  return {
    async write(chunk) {
      parts.push(new Uint8Array(chunk));
    },
    async finish() {
      const blob = new Blob(parts);
      parts = [];
      return blob;
    },
    async abort() {
      parts = [];
    },
  };
}

type DirHandle = FileSystemDirectoryHandle;

async function resolveDirectory(root: DirHandle, segments: string[]): Promise<DirHandle> {
  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

/** Streams straight to a user-chosen folder using the File System Access API. */
export async function createDiskSink(
  root: DirHandle,
  relativePath: string,
  preserveStructure: boolean,
): Promise<FileSink> {
  const rawSegments = relativePath.split("/").filter((s) => s && s !== "." && s !== "..");
  const name = rawSegments.pop() ?? "download";
  const dir = preserveStructure ? await resolveDirectory(root, rawSegments) : root;
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  return {
    async write(chunk) {
      await writable.write(chunk);
    },
    async finish() {
      await writable.close();
      return null;
    },
    async abort() {
      try {
        await writable.abort();
      } catch {
        /* already closed */
      }
    },
  };
}

/* ---------- directory handle persistence (IndexedDB) ---------- */

const DB_NAME = "localsend";
const STORE = "handles";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDirectoryHandle(handle: DirHandle | null): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    if (handle) tx.objectStore(STORE).put(handle, "downloadDir");
    else tx.objectStore(STORE).delete("downloadDir");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDirectoryHandle(): Promise<DirHandle | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const handle = await new Promise<DirHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get("downloadDir");
      req.onsuccess = () => resolve((req.result as DirHandle | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!handle) return null;
    return handle;
  } catch {
    return null;
  }
}
