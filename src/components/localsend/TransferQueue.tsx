import { Inbox } from "lucide-react";
import { TransferItem } from "./TransferItem";
import type { LocalSendEngine } from "@/lib/localsend/engine";
import type { Transfer } from "@/lib/localsend/types";
import { cn } from "@/lib/utils";

export function TransferQueue({
  transfers,
  engine,
  compact,
  floating,
}: {
  transfers: Transfer[];
  engine: LocalSendEngine;
  compact?: boolean | undefined;
  floating?: boolean | undefined;
}) {
  const visible = transfers.filter((t) => t.status !== "awaiting-approval" || t.direction === "send");

  if (visible.length === 0) {
    if (floating) return null;
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">Nothing in the queue</p>
        <p className="text-xs text-muted-foreground">
          Transfers you send or receive show up here with live progress.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", floating && "drop-shadow-lg")}>
      {visible.map((transfer) => (
        <TransferItem key={transfer.id} transfer={transfer} engine={engine} compact={compact} />
      ))}
    </div>
  );
}
