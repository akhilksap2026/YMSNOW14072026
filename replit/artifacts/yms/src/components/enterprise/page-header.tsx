import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  kpiStrip?: ReactNode;
  kpiGrid?: boolean;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, actions, kpiStrip, kpiGrid, children }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight leading-tight" data-testid="text-page-title">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug hidden sm:block" data-testid="text-page-subtitle">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
      {kpiStrip && (
        kpiGrid ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {kpiStrip}
          </div>
        ) : (
          <div className="flex flex-nowrap items-stretch gap-3 overflow-x-auto pb-0.5">
            {kpiStrip}
          </div>
        )
      )}
      {children}
    </div>
  );
}
