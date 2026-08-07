import { Ban, Check, Send, ShieldCheck, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DeviceIcon, deviceTypeLabels } from "./DeviceIcon";
import type { Peer } from "@/lib/localsend/types";
import type { KnownDevice } from "@/lib/localsend/settings";

const connLabels: Record<Peer["conn"], string> = {
  idle: "Nearby",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  failed: "Unreachable",
};

export function DeviceCard({
  peer,
  known,
  selected,
  selectable,
  onSelect,
  onSend,
  onToggleFavorite,
  onToggleTrusted,
  onBlock,
  onForget,
}: {
  peer: Peer;
  known?: KnownDevice | undefined;
  selected?: boolean | undefined;
  selectable?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  onSend?: (() => void) | undefined;
  onToggleFavorite?: (() => void) | undefined;
  onToggleTrusted?: (() => void) | undefined;
  onBlock?: (() => void) | undefined;
  onForget?: (() => void) | undefined;
}) {
  const interactive = selectable || !!onSend;
  return (
    <div
      className={cn(
        "surface-card group relative flex flex-col gap-4 p-5 transition-all",
        interactive && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]",
        selected && "border-primary shadow-[var(--shadow-glow)]",
      )}
      data-selected={selected ? "true" : undefined}
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <DeviceIcon type={peer.info.type} />
          </div>
          {peer.conn === "connected" ? (
            <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-success text-[10px] text-success-foreground">
              <Check className="size-3" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-base font-semibold">{peer.info.name}</p>
            {known?.favorite ? (
              <Star className="size-4 fill-warning text-warning" aria-label="Favorite" />
            ) : null}
            {known?.trusted ? (
              <ShieldCheck className="size-4 text-success" aria-label="Trusted device" />
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {peer.info.os} · {deviceTypeLabels[peer.info.type]}
          </p>
          <Badge
            variant="secondary"
            className="mt-2 gap-1.5 rounded-full text-[11px] font-medium"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                peer.conn === "connected" ? "bg-success" : peer.conn === "failed" ? "bg-destructive" : "bg-primary",
              )}
            />
            {connLabels[peer.conn]}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selectable ? (
          <Button
            variant={selected ? "default" : "outline"}
            size="touch"
            className="flex-1"
            onClick={onSelect}
            aria-pressed={selected}
          >
            {selected ? <Check /> : null}
            {selected ? "Selected" : "Select"}
          </Button>
        ) : null}
        {onSend ? (
          <Button variant="hero" size="touch" className="flex-1" onClick={onSend}>
            <Send /> Send
          </Button>
        ) : null}
        {onToggleFavorite ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={known?.favorite ? "Remove favorite" : "Mark as favorite"}
            onClick={onToggleFavorite}
          >
            <Star className={cn(known?.favorite && "fill-warning text-warning")} />
          </Button>
        ) : null}
        {onToggleTrusted ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={known?.trusted ? "Remove trust" : "Trust this device"}
            onClick={onToggleTrusted}
          >
            <ShieldCheck className={cn(known?.trusted && "text-success")} />
          </Button>
        ) : null}
        {onBlock ? (
          <Button variant="ghost" size="icon" aria-label="Block device" onClick={onBlock}>
            <Ban />
          </Button>
        ) : null}
        {onForget ? (
          <Button variant="ghost" size="icon" aria-label="Forget device" onClick={onForget}>
            <Trash2 />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
