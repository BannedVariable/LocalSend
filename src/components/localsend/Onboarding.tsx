import { useState } from "react";
import { ArrowRight, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, Wordmark } from "./Logo";
import { useLocalSend } from "@/lib/localsend/use-localsend";
import { DeviceIcon, deviceTypeLabels } from "./DeviceIcon";
import type { DeviceType } from "@/lib/localsend/types";
import { cn } from "@/lib/utils";

const types: DeviceType[] = ["desktop", "laptop", "phone", "tablet"];

export function Onboarding() {
  const { state, engine } = useLocalSend();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.identity.name);
  const [type, setType] = useState<DeviceType>(state.identity.type);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="surface-card w-full max-w-md p-7">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <Wordmark className="text-xl" />
            <p className="text-xs text-muted-foreground">Send anything. Locally.</p>
          </div>
        </div>

        {step === 0 ? (
          <div className="mt-6 space-y-4">
            <h1 className="font-display text-2xl font-bold">Welcome to LocalSend</h1>
            <p className="text-sm text-muted-foreground">
              Move files, folders, photos, videos and text straight between your devices. No account,
              no cloud storage for normal transfers — the data travels over an encrypted
              peer-to-peer connection on your network.
            </p>
            <Button variant="hero" size="xl" className="w-full" onClick={() => setStep(1)}>
              Get started <ArrowRight />
            </Button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="device-name" className="text-base">
                What&apos;s your device name?
              </Label>
              <Input
                id="device-name"
                value={name}
                autoFocus
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                className="h-12 text-base"
                placeholder="My PC"
              />
              <p className="text-xs text-muted-foreground">
                Other devices on your network see this name. It stays on this device.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-base">Device type</Label>
              <div className="grid grid-cols-4 gap-2">
                {types.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setType(option)}
                    aria-pressed={type === option}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[11px] font-medium transition-colors",
                      type === option
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <DeviceIcon type={option} className="size-5" />
                    {deviceTypeLabels[option]}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="hero"
              size="xl"
              className="w-full"
              disabled={!name.trim()}
              onClick={() => {
                engine.updateIdentity({ name: name.trim(), type });
                setStep(2);
              }}
            >
              Continue <ArrowRight />
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 space-y-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Wifi className="size-6" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold">LocalSend is ready</h1>
            <p className="text-sm text-muted-foreground">
              Make sure your other device is connected to the same Wi-Fi or network and open
              LocalSend there too. Devices find each other automatically; if your network blocks
              that, you can pair with a QR code or a 6-digit code.
            </p>
            <Button
              variant="hero"
              size="xl"
              className="w-full"
              onClick={() => engine.updateIdentity({ onboarded: true })}
            >
              Show nearby devices <ArrowRight />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
