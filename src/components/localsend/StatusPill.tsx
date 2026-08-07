import { cn } from "@/lib/utils";
import type { NetworkStatus } from "@/lib/localsend/types";

const config: Record<NetworkStatus, { label: string; dot: string; text: string }> = {
  ready: { label: "LocalSend is ready", dot: "bg-success", text: "text-success" },
  connecting: { label: "Connecting…", dot: "bg-warning", text: "text-warning" },
  offline: { label: "Offline", dot: "bg-destructive", text: "text-destructive" },
};

export function StatusPill({
  status,
  detail,
  className,
}: {
  status: NetworkStatus;
  detail?: string | undefined;
  className?: string | undefined;
}) {
  const { label, dot, text } = config[status];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2">
        <span className={cn("absolute inline-flex size-2 rounded-full opacity-60", dot)} />
        <span className={cn("relative inline-flex size-2 rounded-full", dot)} />
      </span>
      <span className={cn("font-semibold", text)}>{label}</span>
      {detail ? <span className="text-muted-foreground">· {detail}</span> : null}
    </div>
  );
}
