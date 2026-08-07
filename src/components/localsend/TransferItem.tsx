import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Circle,
  Download,
  FileArchive,
  Pause,
  Play,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBytes, formatDuration, formatSpeed } from "@/lib/localsend/util";
import { downloadAsZip, downloadBlob } from "@/lib/localsend/download";
import type { LocalSendEngine } from "@/lib/localsend/engine";
import type { Transfer } from "@/lib/localsend/types";
import { toast } from "sonner";

const statusLabels: Record<Transfer["status"], string> = {
  "awaiting-approval": "Waiting for approval",
  active: "Transferring",
  paused: "Paused",
  interrupted: "Connection interrupted",
  done: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
  declined: "Declined",
};

export function TransferItem({
  transfer,
  engine,
  compact,
}: {
  transfer: Transfer;
  engine: LocalSendEngine;
  compact?: boolean | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const percent =
    transfer.totalSize > 0
      ? Math.min(100, Math.round((transfer.transferred / transfer.totalSize) * 100))
      : transfer.status === "done"
        ? 100
        : 0;
  const done = transfer.files.filter((f) => f.status === "done").length;
  const activeCount = transfer.files.filter((f) => f.status === "active").length;
  const waiting = transfer.files.filter((f) => f.status === "waiting").length;
  const currentFile = transfer.files.find((f) => f.meta.fid === transfer.currentFid);
  const received = transfer.direction === "receive" ? engine.getReceivedFiles(transfer.id) : [];
  const savable = received.filter((f) => f.blob);

  const isRunning = transfer.status === "active" || transfer.status === "paused";

  return (
    <div className="surface-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            transfer.status === "done"
              ? "bg-success/15 text-success"
              : transfer.status === "failed" || transfer.status === "declined"
                ? "bg-destructive/15 text-destructive"
                : "bg-accent text-accent-foreground",
          )}
        >
          {transfer.status === "done" ? (
            <Check className="size-4.5" />
          ) : transfer.status === "failed" || transfer.status === "declined" ? (
            <AlertTriangle className="size-4.5" />
          ) : transfer.direction === "send" ? (
            <Upload className="size-4.5" />
          ) : (
            <Download className="size-4.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {transfer.direction === "send" ? "Sending to" : "Receiving from"} {transfer.peer.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {transfer.kind === "text"
              ? "Text message"
              : `${transfer.files.length} file${transfer.files.length === 1 ? "" : "s"} · ${formatBytes(transfer.totalSize)}`}
            {" · "}
            {statusLabels[transfer.status]}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss transfer"
          onClick={() => engine.dismissTransfer(transfer.id)}
        >
          <X />
        </Button>
      </div>

      {transfer.kind === "files" ? (
        <div className="mt-3 space-y-2">
          <Progress value={percent} className="h-2" aria-label="Transfer progress" />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{percent}%</span>
            <span>
              {formatBytes(transfer.transferred)} / {formatBytes(transfer.totalSize)}
            </span>
            {isRunning ? <span>{formatSpeed(transfer.speed)}</span> : null}
            {isRunning ? <span>{formatDuration(transfer.eta)} remaining</span> : null}
          </div>
          {currentFile && isRunning ? (
            <p className="truncate text-xs text-muted-foreground">Current: {currentFile.meta.path}</p>
          ) : null}
          {transfer.files.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              {done} completed · {activeCount} transferring · {waiting} waiting
            </p>
          ) : null}
        </div>
      ) : null}

      {transfer.error ? (
        <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {transfer.error}
        </p>
      ) : null}

      {transfer.status === "done" && transfer.kind === "files" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-success">
            <Check className="size-3" /> {transfer.verified ? "Verified" : "Delivered"}
          </Badge>
          {transfer.direction === "receive" && transfer.writtenToDisk ? (
            <span className="text-xs text-muted-foreground">Saved to your chosen folder</span>
          ) : null}
          {savable.length === 1 ? (
            <Button
              size="sm"
              variant="successOutline"
              onClick={() => downloadBlob(savable[0]!.blob!, savable[0]!.name)}
            >
              <Download /> Save file
            </Button>
          ) : null}
          {savable.length > 1 ? (
            <Button
              size="sm"
              variant="successOutline"
              onClick={() => {
                void downloadAsZip(savable, "localsend-transfer.zip").catch(() =>
                  toast.error("Could not build the ZIP archive."),
                );
              }}
            >
              <FileArchive /> Save all as ZIP
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {transfer.direction === "send" && transfer.status === "active" ? (
          <Button size="sm" variant="outline" onClick={() => engine.pauseTransfer(transfer.id)}>
            <Pause /> Pause
          </Button>
        ) : null}
        {transfer.direction === "send" && transfer.status === "paused" ? (
          <Button size="sm" variant="outline" onClick={() => engine.resumeTransfer(transfer.id)}>
            <Play /> Resume
          </Button>
        ) : null}
        {transfer.direction === "send" && transfer.status === "interrupted" ? (
          <Button size="sm" variant="outline" onClick={() => void engine.retryTransfer(transfer.id)}>
            <RefreshCw /> Retry now
          </Button>
        ) : null}
        {isRunning || transfer.status === "interrupted" || transfer.status === "awaiting-approval" ? (
          <Button size="sm" variant="ghost" onClick={() => engine.cancelTransfer(transfer.id)}>
            <X /> Cancel
          </Button>
        ) : null}
        {!compact && transfer.files.length > 1 ? (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
            {expanded ? "Hide files" : "Show files"}
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {transfer.files.map((file) => {
            const filePercent =
              file.meta.size > 0 ? Math.round((file.transferred / file.meta.size) * 100) : 0;
            return (
              <li key={file.meta.fid} className="flex items-center gap-2 text-xs">
                {file.status === "done" ? (
                  <Check className="size-3.5 shrink-0 text-success" />
                ) : file.status === "active" ? (
                  <Upload className="size-3.5 shrink-0 text-primary" />
                ) : file.status === "failed" ? (
                  <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{file.meta.path}</span>
                <span className="text-muted-foreground">
                  {file.status === "active" ? `${filePercent}%` : formatBytes(file.meta.size)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
