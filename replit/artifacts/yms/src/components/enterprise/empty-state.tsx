import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
}

interface EmptyStateProps {
  icon?: ReactNode;
  heading: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function EmptyState({
  icon,
  heading,
  description,
  action,
  secondaryAction,
  compact = false,
  className = "",
  ...props
}: EmptyStateProps) {
  const py = compact ? "py-10" : "py-16";

  return (
    <div
      className={`flex flex-col items-center justify-center ${py} gap-3 rounded-lg border border-dashed text-center px-6 ${className}`}
      data-testid={props["data-testid"]}
    >
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground/50">
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-medium text-foreground">{heading}</p>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 mt-1">
          {action && (
            action.href ? (
              <Link href={action.href}>
                <Button size="sm" variant="default" className="h-8 text-xs">
                  {action.icon && <span className="mr-1.5">{action.icon}</span>}
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="default" className="h-8 text-xs" onClick={action.onClick}>
                {action.icon && <span className="mr-1.5">{action.icon}</span>}
                {action.label}
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Link href={secondaryAction.href}>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground">
                  {secondaryAction.label}
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
