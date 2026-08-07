import { useState } from "react";
import { Copy, ExternalLink, ShieldCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLocalSend } from "@/lib/localsend/use-localsend";
import { formatBytes, extractUrls, isSafeUrl } from "@/lib/localsend/util";
import { DeviceIcon } from "./DeviceIcon";
import { downloadBlob } from "@/lib/localsend/download";

export function IncomingRequests() {
  const { state, engine } = useLocalSend();
  const [trustDevice, setTrustDevice] = useState(false);
  const request = state.transfers.find(
    (t) => t.direction === "receive" && t.status === "awaiting-approval",
  );

  const types = request
    ? Array.from(new Set(request.files.map((f) => f.meta.mime.split("/")[1] ?? "file"))).slice(0, 4)
    : [];

  return (
    <>
      <Dialog open={!!request} onOpenChange={() => undefined}>
        {request ? (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Incoming transfer</DialogTitle>
              <DialogDescription>
                Approve this transfer only if you recognise the device.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-2xl bg-accent/60 p-4">
              <div className="flex size-11 items-center justify-center rounded-xl bg-surface">
                <DeviceIcon type={request.peer.type} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{request.peer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {request.peer.os} · encrypted peer-to-peer
                </p>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              {request.kind === "text" ? (
                <>
                  <p className="font-medium">Text message</p>
                  <p className="max-h-32 overflow-y-auto rounded-xl bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                    {request.text?.slice(0, 500)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    {request.files.length} file{request.files.length === 1 ? "" : "s"} ·{" "}
                    {formatBytes(request.totalSize)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.files
                      .slice(0, 3)
                      .map((f) => f.meta.path)
                      .join(", ")}
                    {request.files.length > 3 ? `, +${request.files.length - 3} more` : ""}
                  </p>
                  {types.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Types: {types.join(", ")}</p>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="trust"
                checked={trustDevice}
                onCheckedChange={(value) => setTrustDevice(value === true)}
              />
              <Label htmlFor="trust" className="text-xs text-muted-foreground">
                Trust {request.peer.name} (used only if you enable auto-accept in settings)
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="touch"
                className="flex-1"
                onClick={() => void engine.respondToTransfer(request.id, false)}
              >
                Decline
              </Button>
              <Button
                variant="hero"
                size="touch"
                className="flex-1"
                onClick={() => {
                  if (trustDevice) engine.setTrusted(request.peer.id, true);
                  setTrustDevice(false);
                  void engine.respondToTransfer(request.id, true);
                }}
              >
                <ShieldCheck /> Accept
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      {state.texts.length > 0 ? (
        <div className="fixed right-3 top-16 z-40 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 lg:top-6">
          {state.texts.slice(0, 3).map((text) => {
            const urls = extractUrls(text.text).filter(isSafeUrl);
            return (
              <div key={text.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">Text received from {text.from.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Dismiss text"
                    onClick={() => engine.dismissText(text.id)}
                  >
                    <X />
                  </Button>
                </div>
                <p className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                  {text.text}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(text.text)
                        .then(() => toast.success("Copied to clipboard"))
                        .catch(() => toast.error("Your browser blocked clipboard access."));
                    }}
                  >
                    <Copy /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadBlob(
                        new Blob([text.text], { type: "text/plain" }),
                        `localsend-text-${text.id}.txt`,
                      )
                    }
                  >
                    Save
                  </Button>
                  {urls.length > 0 ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={urls[0]} target="_blank" rel="noreferrer noopener">
                        <ExternalLink /> Open link
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
