import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, QrCode, RefreshCw, Unlink, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLocalSend } from "@/lib/localsend/use-localsend";
import { numericCode } from "@/lib/localsend/util";

function roomForCode(code: string): string {
  return `code-${code.replace(/\D/g, "")}`;
}

export function PairingPanel() {
  const { state, engine } = useLocalSend();
  const [code, setCode] = useState<string>(() => numericCode());
  const [joinCode, setJoinCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  const pairUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/?pair=${roomForCode(code)}`;
  }, [code]);

  useEffect(() => {
    if (!pairUrl) return;
    let cancelled = false;
    void QRCode.toDataURL(pairUrl, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => setQr(null));
    return () => {
      cancelled = true;
    };
  }, [pairUrl]);

  const paired = !!state.settings.roomOverride;
  const expiresIn = state.settings.roomOverrideAt
    ? Math.max(
        0,
        Math.round(
          (state.settings.roomOverrideAt + state.settings.sessionMinutes * 60_000 - Date.now()) /
            60_000,
        ),
      )
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="surface-card p-5">
        <div className="flex items-center gap-2">
          <QrCode className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold">Pair a device</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan this code from your other device, or type the 6-digit code there. The code only
          contains a temporary room name — no keys and no personal data.
        </p>

        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
          <div className="rounded-2xl border border-border bg-white p-3">
            {qr ? (
              <img src={qr} alt={`QR code to pair with LocalSend using code ${code}`} width={168} height={168} />
            ) : (
              <div className="size-[168px] animate-pulse rounded-xl bg-muted" />
            )}
          </div>
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pairing code</p>
              <p className="font-display text-3xl font-bold tabular-nums tracking-[0.2em]">
                {code.slice(0, 3)} {code.slice(3)}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCode(numericCode());
                  toast.success("New pairing code generated");
                }}
              >
                <RefreshCw /> New code
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(pairUrl)
                    .then(() => toast.success("Pairing link copied"))
                    .catch(() => toast.error("Clipboard access was blocked."));
                }}
              >
                <Copy /> Copy link
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={() => {
                  void engine.joinRoomCode(roomForCode(code));
                  toast.success("Waiting for the other device to join this code");
                }}
              >
                Use this code
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="flex items-center gap-2">
          <Wifi className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold">Connect manually</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Browsers can&apos;t scan your LAN for IP addresses, so LocalSend pairs devices with a
          shared code instead of an address. Both devices entering the same code join the same
          private signalling room.
        </p>

        <div className="mt-4 space-y-2">
          <Label htmlFor="join-code">Pairing code from the other device</Label>
          <div className="flex gap-2">
            <Input
              id="join-code"
              inputMode="numeric"
              placeholder="482 913"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              className="h-12 text-base tracking-widest"
            />
            <Button
              size="touch"
              disabled={joinCode.replace(/\D/g, "").length < 6}
              onClick={() => {
                void engine.joinRoomCode(roomForCode(joinCode));
                toast.success("Joining paired room…");
              }}
            >
              Join
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            {paired ? "Paired room active" : "Automatic discovery active"}
          </p>
          <p className="mt-1">
            {paired
              ? `Room ${state.settings.roomOverride}${expiresIn != null ? ` · expires in about ${expiresIn} min` : ""}`
              : "Devices behind the same router are grouped automatically."}
          </p>
          {paired ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                void engine.useAutomaticRoom();
                toast.success("Pairing revoked");
              }}
            >
              <Unlink /> Revoke pairing
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
