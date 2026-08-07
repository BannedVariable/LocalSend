import { createFileRoute } from "@tanstack/react-router";
import { DeviceCard } from "@/components/localsend/DeviceCard";
import { PairingPanel } from "@/components/localsend/PairingPanel";
import { useLocalSend } from "@/lib/localsend/use-localsend";

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: "Devices & pairing — LocalSend" },
      {
        name: "description",
        content:
          "Manage nearby devices, favourites and trusted devices, or pair manually with a QR code or 6-digit code.",
      },
      { property: "og:title", content: "Devices & pairing — LocalSend" },
      {
        property: "og:description",
        content: "Pair devices with a QR or numeric code and manage trust.",
      },
    ],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const { state, engine } = useLocalSend();
  const known = Object.values(state.settings.knownDevices);
  const onlineIds = new Set(state.peers.map((p) => p.info.id));
  const offline = known.filter((device) => !onlineIds.has(device.id));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trust a device to allow auto-accept, or block it to ignore its requests.
        </p>
      </header>

      <PairingPanel />

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Online now</h2>
        {state.peers.length === 0 ? (
          <p className="surface-card p-6 text-sm text-muted-foreground">No devices online.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {state.peers.map((peer) => (
              <DeviceCard
                key={peer.info.id}
                peer={peer}
                known={state.settings.knownDevices[peer.info.id]}
                onToggleFavorite={() =>
                  engine.setFavorite(peer.info.id, !state.settings.knownDevices[peer.info.id]?.favorite)
                }
                onToggleTrusted={() =>
                  engine.setTrusted(peer.info.id, !state.settings.knownDevices[peer.info.id]?.trusted)
                }
                onBlock={() =>
                  engine.setBlocked(peer.info.id, !state.settings.knownDevices[peer.info.id]?.blocked)
                }
                onForget={() => engine.forgetDevice(peer.info.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Known devices (offline)</h2>
        {offline.length === 0 ? (
          <p className="surface-card p-6 text-sm text-muted-foreground">
            Devices you have transferred with show up here.
          </p>
        ) : (
          <ul className="surface-card divide-y divide-border">
            {offline.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{device.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {device.trusted ? "Trusted" : "Not trusted"}
                    {device.blocked ? " · Blocked" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline"
                  onClick={() => engine.forgetDevice(device.id)}
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
