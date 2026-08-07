import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowDownToLine, FileUp, QrCode, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceCard } from "@/components/localsend/DeviceCard";
import { StatusPill } from "@/components/localsend/StatusPill";
import { TransferQueue } from "@/components/localsend/TransferQueue";
import { useLocalSend } from "@/lib/localsend/use-localsend";
import { setPendingDevice } from "@/lib/localsend/pending";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LocalSend — Share files across your local network" },
      {
        name: "description",
        content:
          "Send files, folders and text directly between your devices on the same network. Encrypted peer-to-peer transfers, no accounts, no cloud storage.",
      },
      { property: "og:title", content: "LocalSend — Share files across your local network" },
      {
        property: "og:description",
        content: "Encrypted peer-to-peer file sharing between your own devices. No account needed.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { state, engine } = useLocalSend();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pair = new URLSearchParams(window.location.search).get("pair");
    if (pair) {
      void engine.joinRoomCode(pair);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [engine]);

  const visible = state.peers.filter((p) => !state.settings.knownDevices[p.info.id]?.blocked);

  return (
    <div className="space-y-6">
      <section className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Nearby devices</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              You appear as <span className="font-medium text-foreground">{state.identity.name}</span>.
              Devices on the same network find each other automatically.
            </p>
          </div>
          <StatusPill
            status={state.status}
            detail={state.roomIsAutomatic ? "Automatic discovery" : "Paired room"}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="hero" size="touch" onClick={() => void navigate({ to: "/send" })}>
            <FileUp /> Send files
          </Button>
          <Button variant="soft" size="touch" onClick={() => void navigate({ to: "/send" })}>
            <Type /> Send text
          </Button>
          <Button variant="outline" size="touch" asChild>
            <Link to="/receive">
              <ArrowDownToLine /> Receive
            </Link>
          </Button>
          <Button variant="ghost" size="touch" asChild>
            <Link to="/devices">
              <QrCode /> Pair a device
            </Link>
          </Button>
        </div>
      </section>

      {state.discoveryError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {state.discoveryError}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          {visible.length > 0 ? `${visible.length} device${visible.length === 1 ? "" : "s"} online` : "Looking for devices…"}
        </h2>
        {visible.length === 0 ? (
          <div className="surface-card p-6 text-sm text-muted-foreground">
            <p>
              Open LocalSend on your other device using the same Wi-Fi. If your network isolates
              clients, use <Link to="/devices" className="font-medium text-primary underline">pairing</Link>{" "}
              with a QR or 6-digit code instead.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((peer) => (
              <DeviceCard
                key={peer.info.id}
                peer={peer}
                known={state.settings.knownDevices[peer.info.id]}
                onSend={() => {
                  setPendingDevice(peer.info.id);
                  void navigate({ to: "/send" });
                }}
                onToggleFavorite={() =>
                  engine.setFavorite(
                    peer.info.id,
                    !state.settings.knownDevices[peer.info.id]?.favorite,
                  )
                }
                onToggleTrusted={() =>
                  engine.setTrusted(
                    peer.info.id,
                    !state.settings.knownDevices[peer.info.id]?.trusted,
                  )
                }
                onBlock={() => engine.setBlocked(peer.info.id, true)}
              />
            ))}
          </div>
        )}
      </section>

      {state.transfers.length > 0 ? (
        <section className="xl:hidden">
          <h2 className="mb-3 font-display text-lg font-semibold">Transfers</h2>
          <TransferQueue transfers={state.transfers.slice(0, 5)} engine={engine} />
        </section>
      ) : null}
    </div>
  );
}
