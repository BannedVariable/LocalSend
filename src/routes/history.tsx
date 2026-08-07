import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalSend } from "@/lib/localsend/use-localsend";
import { formatBytes } from "@/lib/localsend/util";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Transfer history — LocalSend" },
      {
        name: "description",
        content:
          "A local-only log of what you sent and received, stored on this device and clearable at any time.",
      },
      { property: "og:title", content: "Transfer history — LocalSend" },
      { property: "og:description", content: "Local-only log of sent and received transfers." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { state, engine } = useLocalSend();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stored only on this device. File contents are never kept.
          </p>
        </div>
        {state.history.length > 0 ? (
          <Button variant="outline" size="touch" onClick={() => engine.clearHistoryEntries()}>
            <Trash2 /> Clear history
          </Button>
        ) : null}
      </header>

      {state.history.length === 0 ? (
        <p className="surface-card p-6 text-sm text-muted-foreground">No transfers yet.</p>
      ) : (
        <ul className="surface-card divide-y divide-border">
          {state.history.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 p-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                {entry.direction === "send" ? (
                  <ArrowUpFromLine className="size-4" aria-hidden="true" />
                ) : (
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{entry.name}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.direction === "send" ? "To" : "From"} {entry.deviceName} ·{" "}
                  {new Date(entry.at).toLocaleString()}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{formatBytes(entry.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
