import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransferQueue } from "@/components/localsend/TransferQueue";
import { StatusPill } from "@/components/localsend/StatusPill";
import { useLocalSend } from "@/lib/localsend/use-localsend";
import { toast } from "sonner";

export const Route = createFileRoute("/receive")({
  head: () => ({
    meta: [
      { title: "Receive files — LocalSend" },
      {
        name: "description",
        content:
          "Stay discoverable, approve incoming transfers and save received files straight to a folder on this device.",
      },
      { property: "og:title", content: "Receive files — LocalSend" },
      {
        property: "og:description",
        content: "Approve incoming transfers and save files directly to disk.",
      },
    ],
  }),
  component: ReceivePage,
});

function ReceivePage() {
  const { state, engine } = useLocalSend();
  const incoming = state.transfers.filter((t) => t.direction === "receive");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Receive</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This device is visible as{" "}
            <span className="font-medium text-foreground">{state.identity.name}</span> while
            LocalSend is open.
          </p>
        </div>
        <StatusPill status={state.status} detail={`${state.peers.length} nearby`} />
      </header>

      <section className="surface-card p-5">
        <h2 className="font-display text-lg font-semibold">Save location</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.capabilities.directoryPicker
            ? state.downloadFolder
              ? `Files stream straight into “${state.downloadFolder}”.`
              : "Choose a folder to write files directly to disk, or keep saving them one by one from the transfer list."
            : "Your browser can't write folders directly, so files are saved through the normal download flow (folders arrive as a ZIP)."}
        </p>
        {state.capabilities.directoryPicker ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="touch"
              onClick={() =>
                void engine
                  .chooseDownloadFolder()
                  .then(() => toast.success("Download folder set"))
                  .catch(() => toast.error("Folder selection was cancelled or blocked."))
              }
            >
              <FolderOpen /> {state.downloadFolder ? "Change folder" : "Choose folder"}
            </Button>
            {state.downloadFolder ? (
              <Button variant="ghost" size="touch" onClick={() => void engine.clearDownloadFolder()}>
                Use downloads instead
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Incoming</h2>
        {incoming.length === 0 ? (
          <p className="surface-card p-6 text-sm text-muted-foreground">
            Nothing yet. Keep this tab open — incoming transfers appear here for approval.
          </p>
        ) : (
          <TransferQueue transfers={incoming} engine={engine} />
        )}
      </section>
    </div>
  );
}
