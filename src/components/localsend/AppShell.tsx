import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  Clock,
  Home,
  Info,
  MonitorSmartphone,
  Send,
  Settings,
  ShieldQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, Wordmark } from "./Logo";
import { StatusPill } from "./StatusPill";
import { useLocalSend } from "@/lib/localsend/use-localsend";
import { TransferQueue } from "./TransferQueue";
import { IncomingRequests } from "./IncomingRequests";
import { Onboarding } from "./Onboarding";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/send", label: "Send", icon: Send },
  { to: "/receive", label: "Receive", icon: ArrowDownToLine },
  { to: "/devices", label: "Devices", icon: MonitorSmartphone },
  { to: "/history", label: "History", icon: Clock },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const mobileNav = navItems.filter((item) =>
  ["/", "/send", "/receive", "/devices", "/settings"].includes(item.to),
);

export function AppShell({ children }: { children: ReactNode }) {
  const { state, engine } = useLocalSend();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeTransfers = state.transfers.filter(
    (t) => t.status === "active" || t.status === "paused" || t.status === "interrupted",
  );

  if (state.hydrated && !state.identity.onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={30} />
          <Wordmark />
        </Link>
        <StatusPill status={state.status} />
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
          <Link to="/" className="mb-8 flex items-center gap-3 px-2">
            <Logo size={38} />
            <div>
              <Wordmark className="text-xl" />
              <p className="text-xs text-muted-foreground">Send anything. Locally.</p>
            </div>
          </Link>
          <nav className="flex flex-col gap-1" aria-label="Main">
            {navItems.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="size-4.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col gap-1 pt-6 text-sm">
            <Link
              to="/troubleshooting"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
            >
              <ShieldQuestion className="size-4" aria-hidden="true" /> Troubleshooting
            </Link>
            <Link
              to="/about"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
            >
              <Info className="size-4" aria-hidden="true" /> About &amp; privacy
            </Link>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-6 lg:px-8 lg:pb-10">
          {children}
        </main>

        {/* Desktop activity rail */}
        <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col border-l border-border bg-sidebar/50 px-4 py-6 xl:flex">
          <h2 className="mb-3 px-1 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <TransferQueue transfers={state.transfers} engine={engine} compact />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <StatusPill
              status={state.status}
              detail={
                state.status === "ready"
                  ? `${state.peers.length} nearby`
                  : state.roomIsAutomatic
                    ? "Automatic discovery"
                    : "Paired room"
              }
            />
          </div>
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Main"
      >
        {mobileNav.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {activeTransfers.length > 0 ? (
        <div className="fixed inset-x-3 bottom-[4.75rem] z-20 xl:hidden">
          <TransferQueue transfers={activeTransfers.slice(0, 1)} engine={engine} floating />
        </div>
      ) : null}

      <IncomingRequests />
    </div>
  );
}
