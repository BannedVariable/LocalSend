import { Laptop, Monitor, Smartphone, Tablet, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceType } from "@/lib/localsend/types";

const icons: Record<DeviceType, LucideIcon> = {
  desktop: Monitor,
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  unknown: HelpCircle,
};

export const deviceTypeLabels: Record<DeviceType, string> = {
  desktop: "Desktop",
  laptop: "Laptop",
  phone: "Phone",
  tablet: "Tablet",
  unknown: "Unknown device",
};

export function DeviceIcon({
  type,
  className,
}: {
  type: DeviceType;
  className?: string | undefined;
}) {
  const Icon = icons[type] ?? HelpCircle;
  return <Icon className={cn("size-6", className)} aria-hidden="true" />;
}
