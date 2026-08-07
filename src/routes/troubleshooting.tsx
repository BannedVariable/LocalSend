import { createFileRoute } from "@tanstack/react-router";
import { useLocalSend } from "@/lib/localsend/use-localsend";

export const Route = createFileRoute("/troubleshooting")({
  head: () => ({
    meta: [
      { title: "Troubleshooting — LocalSend" },
      {
        name: "description",
        content:
          "Fix discovery problems, blocked networks, browser limits and interrupted transfers in LocalSend.",
      },
      { property: "og:title", content: "Troubleshooting — LocalSend" },
      { property: "og:description", content: "Fix discovery, network and transfer problems." },
    ],
  }),
  component: TroubleshootingPage,
});

const items = [
  {
    q: "My other device doesn't show up",
    a: "Both devices must have LocalSend open, on the same network. Guest networks and “client isolation” on the router block device-to-device traffic — pair with a QR or 6-digit code, or switch both devices to the same Wi-Fi.",
  },
  {
    q: "The transfer stopped halfway",
    a: "Reopen both tabs and press Retry on the transfer. Completed chunks are remembered, so a resumed transfer continues where it stopped instead of starting over.",
  },
  {
    q: "Files land in Downloads instead of my folder",
    a: "Direct folder writing needs a Chromium-based desktop browser. Elsewhere, files save one at a time, and folders arrive as a ZIP.",
  },
  {
    q: "Large files fail on mobile",
    a: "Phones drop background tabs. Keep the LocalSend tab in the foreground and the screen awake for very large transfers.",
  },
  {
    q: "Is anything uploaded to a server?",
    a: "Only the small connection handshake. File contents travel directly between devices over an encrypted peer-to-peer channel.",
  },
];

function TroubleshootingPage() {
  const { state } = useLocalSend();
  const caps = state.capabilities;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Troubleshooting</h1>
        <p className="mt-1 text-sm text-muted-foreground">Common issues and what to do about them.</p>
      </header>

      <section className="surface-card divide-y divide-border">
        {items.map((item) => (
          <details key={item.q} className="group p-4">
            <summary className="cursor-pointer text-sm font-semibold">{item.q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </section>

      <section className="surface-card p-5">
        <h2 className="font-display text-lg font-semibold">This browser supports</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Peer-to-peer transfers", caps.webrtc && caps.dataChannel],
            ["Write files straight to a folder", caps.directoryPicker],
            ["Integrity checks", caps.crypto],
            ["Notifications", caps.notifications],
            ["Clipboard paste", caps.clipboardRead],
            ["Vibration", caps.vibration],
          ].map(([label, ok]) => (
            <li key={String(label)} className="flex items-center gap-2">
              <span
                className={ok ? "size-2 rounded-full bg-primary" : "size-2 rounded-full bg-muted-foreground/50"}
                aria-hidden="true"
              />
              <span className={ok ? "" : "text-muted-foreground"}>
                {label}
                {ok ? "" : " — not available"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
