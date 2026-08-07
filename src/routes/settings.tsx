import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLocalSend } from "@/lib/localsend/use-localsend";
import type { Settings } from "@/lib/localsend/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LocalSend" },
      {
        name: "description",
        content:
          "Rename this device, control approval and auto-accept, toggle sounds and notifications, and reset local data.",
      },
      { property: "og:title", content: "Settings — LocalSend" },
      { property: "og:description", content: "Control device name, approvals, alerts and data." },
    ],
  }),
  component: SettingsPage,
});

const toggles: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "askBeforeReceiving", label: "Ask before receiving", hint: "Approve every incoming transfer." },
  { key: "autoAcceptTrusted", label: "Auto-accept trusted devices", hint: "Skip approval for devices you marked trusted." },
  { key: "preserveFolderStructure", label: "Keep folder structure", hint: "Recreate folders instead of flattening files." },
  { key: "verifyTransfers", label: "Verify integrity", hint: "Check SHA-256 hashes for every chunk." },
  { key: "notifications", label: "Notifications", hint: "Show a system notification when a transfer arrives." },
  { key: "sounds", label: "Sounds", hint: "Play a chime on completion or failure." },
  { key: "haptics", label: "Haptics", hint: "Vibrate on mobile devices." },
  { key: "reducedMotion", label: "Reduce motion", hint: "Minimise animations." },
];

function SettingsPage() {
  const { state, engine } = useLocalSend();
  const [name, setName] = useState(state.identity.name);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything here stays on this device.
        </p>
      </header>

      <section className="surface-card space-y-3 p-5">
        <Label htmlFor="name" className="text-base">
          Device name
        </Label>
        <div className="flex gap-2">
          <Input
            id="name"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            className="h-11"
          />
          <Button
            size="touch"
            disabled={!name.trim() || name === state.identity.name}
            onClick={() => {
              engine.updateIdentity({ name: name.trim() });
              toast.success("Device name updated");
            }}
          >
            Save
          </Button>
        </div>
      </section>

      <section className="surface-card divide-y divide-border p-1">
        {toggles.map((toggle) => (
          <div key={toggle.key} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{toggle.label}</p>
              <p className="text-xs text-muted-foreground">{toggle.hint}</p>
            </div>
            <Switch
              checked={state.settings[toggle.key] === true}
              aria-label={toggle.label}
              onCheckedChange={(value) => engine.updateSettings({ [toggle.key]: value })}
            />
          </div>
        ))}
      </section>

      <section className="surface-card space-y-3 p-5">
        <Label htmlFor="session" className="text-base">
          Pairing session length (minutes)
        </Label>
        <Input
          id="session"
          type="number"
          min={5}
          max={720}
          value={state.settings.sessionMinutes}
          onChange={(event) =>
            engine.updateSettings({ sessionMinutes: Math.max(5, Number(event.target.value) || 60) })
          }
          className="h-11 w-32"
        />
        <p className="text-xs text-muted-foreground">
          After this time a paired room expires and discovery returns to automatic.
        </p>
      </section>

      <section className="surface-card space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Local data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="touch" onClick={() => engine.clearHistoryEntries()}>
            Clear history
          </Button>
          <Button variant="outline" size="touch" onClick={() => engine.clearDeviceData()}>
            Forget all devices
          </Button>
          <Button
            variant="destructive"
            size="touch"
            onClick={() => {
              void engine.resetEverything();
              toast.success("LocalSend reset");
            }}
          >
            Reset everything
          </Button>
        </div>
      </section>
    </div>
  );
}
