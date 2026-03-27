import { Badge } from "@/components/ui/badge";
import { FileText, Shield, Wrench, Globe, Edit2, AlertOctagon, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HoldTypeConfig {
  label: string;
  abbr: string;
  color: string;
  icon: LucideIcon;
}

export const HOLD_TYPE_CONFIG: Record<string, HoldTypeConfig> = {
  documentation_hold: {
    label: "Documentation",
    abbr: "DOC",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700",
    icon: FileText,
  },
  security_hold: {
    label: "Security",
    abbr: "SEC",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700",
    icon: Shield,
  },
  damage_hold: {
    label: "Damage",
    abbr: "DMG",
    color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700",
    icon: Wrench,
  },
  customs_hold: {
    label: "Customs",
    abbr: "CST",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700",
    icon: Globe,
  },
  manual_modification: {
    label: "Manual",
    abbr: "MNL",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700",
    icon: Edit2,
  },
  seal_mismatch: {
    label: "Seal Mismatch",
    abbr: "SEAL",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-700",
    icon: AlertOctagon,
  },
  driver: {
    label: "Driver",
    abbr: "DRV",
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-600",
    icon: User,
  },
};

function getHoldConfig(type: string): HoldTypeConfig {
  return HOLD_TYPE_CONFIG[type] ?? {
    label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    abbr: type.slice(0, 3).toUpperCase(),
    color: "bg-secondary text-secondary-foreground border-border",
    icon: AlertOctagon,
  };
}

interface HoldTypeBadgeProps {
  type: string;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function HoldTypeBadge({
  type,
  size = "sm",
  showIcon = true,
  showLabel = true,
  className,
}: HoldTypeBadgeProps) {
  const cfg = getHoldConfig(type);
  const Icon = cfg.icon;
  const sizeClasses = {
    xs: "text-[9px] px-1 py-0 h-4 gap-0.5",
    sm: "text-[10px] px-1.5 py-0 h-5 gap-1",
    md: "text-xs px-2 py-0.5 h-6 gap-1",
  }[size];
  const iconSize = { xs: "h-2.5 w-2.5", sm: "h-3 w-3", md: "h-3.5 w-3.5" }[size];

  return (
    <Badge
      className={cn(
        "inline-flex items-center font-semibold border rounded",
        cfg.color,
        sizeClasses,
        className,
      )}
      data-testid={`badge-hold-type-${type}`}
    >
      {showIcon && <Icon className={cn(iconSize, "shrink-0")} />}
      {showLabel && <span>{cfg.label}</span>}
    </Badge>
  );
}

export function holdTypeColor(type: string): string {
  return HOLD_TYPE_CONFIG[type]?.color ?? "bg-secondary text-secondary-foreground";
}
