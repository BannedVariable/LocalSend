import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, FolderUp, Send, Trash2, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDropFiles, useLocalSend } from "@/lib/localsend/use-localsend";
import type { OutgoingItem } from "@/lib/localsend/engine";
import { formatBytes } from "@/lib/localsend/util";
import { DeviceIcon } from "./DeviceIcon";
import { takePendingDevice, takePendingItems, takePendingText } from "@/lib/localsend/pending";

type Mode = "files" | "text";

export function SendComposer() {
  const { state, engine } = useLocalSend();
  const [mode, setMode] = useState<Mode>("files");
  const [items, setItems] = useState<OutgoingItem[]>([]);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pendingItems = takePendingItems();
    if (pendingItems.length > 0) setItems(pendingItems);
    const pendingText = takePendingText();
    if (pendingText) {
      setText(pendingText);
      setMode("text");
    }
    const device = takePendingDevice();
    if (device) setSelected([device]);
  }, []);

  const addItems = (next: OutgoingItem[]) => {
    setItems((prev) => {
      const seen = new Set(prev.map((i) => `${i.path}:${i.file.size}`));
      return [...prev, ...next.filter((i) => !seen.has(`${i.path}:${i.file.size}`))];
    });
    setMode("files");
  };

  const { dragging, handlers } = useDropFiles(addItems);

  const totalSize = useMemo(() => items.reduce((sum, i) => sum + i.file.size, 0), [items]);
  const available = state.peers.filter((p) => !state.settings.knownDevices[p.info.id]?.blocked);
  const canSend =
    selected.length > 0 && !sending && (mode === "text" ? text.trim().length > 0 : items.length > 0);

  const submit = async () => {
    setSending(true);
    try {
      if (mode === "text") {
        await engine.sendText(text.trim(), selected);
        toast.success("Text sent for approval");
        setText("");
      } else {
        await engine.sendFiles(items, selected);
        toast.success(`Sending ${items.length} file${items.length === 1 ? "" : "s"}`);
        setItems([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the transfer.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="surface-card p-5">
        <div className="flex gap-2" role="tablist" aria-label="What to send">
          <Button
            role="tab"
            aria-selected={mode === "files"}
            variant={mode === "files" ? "soft" : "ghost"}
            onClick={() => setMode("files")}
          >
            <FileUp /> Files &amp; folders
          </Button>
          <Button
            role="tab"
            aria-selected={mode === "text"}
            variant={mode === "text" ? "soft" : "ghost"}
            onClick={() => setMode("text")}
          >
            <Type /> Text
          </Button>
        </div>

        {mode === "files" ? (
          <div className="mt-4 space-y-4">
            <div
              {...handlers}
              className={cn(
                "rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
                dragging ? "border-primary bg-accent/60" : "border-border bg-muted/40",
              )}
            >
              <p className="font-display text-lg font-semibold">Drop files or folders here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Folder structure is kept when the receiver allows it.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="touch" onClick={() => filesInput.current?.click()}>
                  <FileUp /> Choose files
                </Button>
                <Button variant="outline" size="touch" onClick={() => folderInput.current?.click()}>
                  <FolderUp /> Choose folder
                </Button>
              </div>
              <input
                ref={filesInput}
                type="file"
                multiple
                className="sr-only"
                aria-label="Choose files to send"
                onChange={(event) => {
                  const list = Array.from(event.target.files ?? []);
                  addItems(list.map((file) => ({ file, path: file.name })));
                  event.target.value = "";
                }}
              />
              <input
                ref={folderInput}
                type="file"
                multiple
                // @ts-expect-error non-standard but widely supported attribute
                webkitdirectory="true"
                directory="true"
                className="sr-only"
                aria-label="Choose a folder to send"
                onChange={(event) => {
                  const list = Array.from(event.target.files ?? []);
                  addItems(
                    list.map((file) => ({
                      file,
                      path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
                    })),
                  );
                  event.target.value = "";
                }}
              />
            </div>

            {items.length > 0 ? (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {items.length} item{items.length === 1 ? "" : "s"} · {formatBytes(totalSize)}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setItems([])}>
                    <Trash2 /> Clear
                  </Button>
                </div>
                <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {items.map((item, index) => (
                    <li
                      key={`${item.path}-${index}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="truncate" title={item.path}>
                        {item.path}
                      </span>
                      <span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                        {formatBytes(item.file.size)}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${item.path}`}
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <X />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste a link, a code snippet or a note…"
              className="min-h-40 text-base"
              aria-label="Text to send"
            />
            <p className="text-xs text-muted-foreground">
              {text.length} characters. Links arrive as tappable links on the other device.
            </p>
          </div>
        )}
      </div>

      <div className="surface-card flex flex-col p-5">
        <h2 className="font-display text-lg font-semibold">Send to</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick one or more devices. Each receiver approves the transfer.
        </p>

        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {available.length === 0 ? (
            <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
              No devices nearby yet. Open LocalSend on your other device, or pair with a code from
              the Devices tab.
            </p>
          ) : (
            available.map((peer) => {
              const active = selected.includes(peer.info.id);
              return (
                <button
                  key={peer.info.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelected((prev) =>
                      prev.includes(peer.info.id)
                        ? prev.filter((id) => id !== peer.info.id)
                        : [...prev, peer.info.id],
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    active ? "border-primary bg-accent" : "border-border hover:bg-muted",
                  )}
                >
                  <DeviceIcon type={peer.info.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{peer.info.name}</span>
                    <span className="block text-xs text-muted-foreground">{peer.info.os}</span>
                  </span>
                  {active ? <span className="text-xs font-semibold text-primary">Selected</span> : null}
                </button>
              );
            })
          )}
        </div>

        <Button
          variant="hero"
          size="xl"
          className="mt-4 w-full"
          disabled={!canSend}
          onClick={() => void submit()}
        >
          <Send /> {sending ? "Starting…" : mode === "text" ? "Send text" : "Send files"}
        </Button>
      </div>
    </div>
  );
}
