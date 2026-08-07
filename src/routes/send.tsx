import { createFileRoute } from "@tanstack/react-router";
import { SendComposer } from "@/components/localsend/SendComposer";

export const Route = createFileRoute("/send")({
  head: () => ({
    meta: [
      { title: "Send files or text — LocalSend" },
      {
        name: "description",
        content:
          "Pick files, whole folders or text and send them straight to another device on your network.",
      },
      { property: "og:title", content: "Send files or text — LocalSend" },
      {
        property: "og:description",
        content: "Choose files, folders or text and transfer them peer-to-peer.",
      },
    ],
  }),
  component: SendPage,
});

function SendPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Send</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Files never pass through a server — only the connection handshake does.
        </p>
      </header>
      <SendComposer />
    </div>
  );
}
