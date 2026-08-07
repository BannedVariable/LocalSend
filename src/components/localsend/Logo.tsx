import logo from "@/assets/localsend-logo.png";
import { cn } from "@/lib/utils";

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <img
      src={logo}
      alt="LocalSend logo"
      width={size}
      height={size}
      className={cn("rounded-xl", className)}
    />
  );
}

export function Wordmark({ className }: { className?: string | undefined }) {
  return (
    <span className={cn("font-display text-lg font-bold tracking-tight", className)}>
      Local<span className="text-primary">Send</span>
    </span>
  );
}
