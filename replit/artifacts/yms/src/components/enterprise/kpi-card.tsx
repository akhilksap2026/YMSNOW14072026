import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
  accent?: string;
  className?: string;
  "data-testid"?: string;
  onClick?: () => void;
  href?: string;
  footer?: ReactNode;
}

export function KPICard({ label, value, icon, trend, accent, className = "", onClick, href, footer, ...props }: KPICardProps) {
  const accentBorder = accent || "border-l-primary/40";
  const isClickable = !!(onClick || href);

  const inner = (
    <div
      className={`relative flex items-start gap-3 rounded-lg border border-l-[3px] ${accentBorder} bg-card p-3.5 flex-1 min-w-[140px] transition-all ${
        isClickable ? "cursor-pointer hover:bg-accent/50 hover:border-border/80 hover:shadow-sm group" : ""
      } ${className}`}
      data-testid={props["data-testid"]}
      onClick={onClick}
    >
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider leading-none mb-1.5">{label}</p>
        <p className="text-2xl font-bold leading-none tracking-tight">{value}</p>
        {trend && (
          <p className={`text-[11px] mt-1.5 font-medium ${trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {trend.value}
          </p>
        )}
        {footer && (
          <div className="mt-2">
            {footer}
          </div>
        )}
      </div>
      {isClickable && (
        <ChevronRight className="absolute bottom-2.5 right-2.5 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="flex-1 min-w-[140px]">{inner}</Link>;
  }

  return inner;
}
