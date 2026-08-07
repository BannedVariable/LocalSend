import type { ReceivedFile } from "./engine";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** ZIP fallback for folder transfers when direct folder writing isn't available. */
export async function downloadAsZip(files: ReceivedFile[], zipName: string): Promise<void> {
  const { zipSync } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    if (!file.blob) continue;
    const buffer = new Uint8Array(await file.blob.arrayBuffer());
    let path = file.path || file.name;
    let counter = 1;
    while (entries[path]) path = `${counter++}-${file.path || file.name}`;
    entries[path] = buffer;
  }
  const zipped = zipSync(entries, { level: 0 });
  downloadBlob(new Blob([zipped as unknown as BlobPart], { type: "application/zip" }), zipName);
}
