import { createFileRoute } from "@tanstack/react-router";
import { Logo, Wordmark } from "@/components/localsend/Logo";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & privacy — LocalSend" },
      {
        name: "description",
        content:
          "How LocalSend works: encrypted peer-to-peer transfers, a minimal signalling handshake, and no file contents stored anywhere.",
      },
      { property: "og:title", content: "About & privacy — LocalSend" },
      {
        property: "og:description",
        content: "How LocalSend transfers data and what leaves your device.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <Wordmark className="text-2xl" />
          <p className="text-sm text-muted-foreground">Send anything. Locally.</p>
        </div>
      </header>

      <section className="surface-card space-y-3 p-5 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">How it works</h2>
        <p>
          Devices announce themselves in a small signalling room so they can find each other. Once
          two devices agree to talk, they open a direct encrypted connection and the files move
          between them without touching a server.
        </p>
        <p>
          Every file is split into 64 KB chunks. Each chunk is hashed, and the receiver verifies the
          full file when it lands, so a corrupted transfer is caught instead of silently saved. If a
          connection drops, the completed chunks are remembered and the transfer resumes.
        </p>
      </section>

      <section className="surface-card space-y-3 p-5 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">Privacy</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>File contents are never uploaded or stored anywhere.</li>
          <li>Your device name, type and platform are shared with devices in your room only.</li>
          <li>History, trusted devices and settings live in this browser and can be cleared.</li>
          <li>No accounts, no tracking, no analytics.</li>
        </ul>
      </section>
    </div>
  );
}
