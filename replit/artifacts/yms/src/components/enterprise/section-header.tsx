import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  count?: number;
  description?: string;
  action?: ReactNode;
  divider?: boolean;
  className?: string;
}

export function SectionHeader({ title, count, description, action, divider = false, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${divider ? "border-b pb-2" : ""} ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-sm font-semibold leading-none tracking-tight text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
        {description && (
          <span className="text-xs text-muted-foreground hidden sm:inline truncate">{description}</span>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-1 shrink-0">{action}</div>
      )}
    </div>
  );
}
