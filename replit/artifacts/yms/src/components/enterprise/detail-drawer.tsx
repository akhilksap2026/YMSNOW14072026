import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  width = "md",
}: DetailDrawerProps) {
  const widthClass = width === "sm" ? "sm:max-w-md" : width === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={`${widthClass} flex flex-col p-0`}>
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="text-base font-semibold leading-tight">{title}</SheetTitle>
          {subtitle && (
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">{subtitle}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {children}
        </div>
        {footer && (
          <div className="border-t px-5 py-3.5 shrink-0 bg-muted/20">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface DrawerSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function DrawerSection({ title, children, className = "" }: DrawerSectionProps) {
  return (
    <div className={`space-y-0 ${className}`}>
      {title && (
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 pb-1.5 border-b">
          {title}
        </p>
      )}
      <div className="divide-y">
        {children}
      </div>
    </div>
  );
}

interface DrawerFieldProps {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

export function DrawerField({ label, value, fullWidth = false }: DrawerFieldProps) {
  if (fullWidth) {
    return (
      <div className="py-2.5 space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <div className="text-sm">{value || <span className="text-muted-foreground/60">—</span>}</div>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-[11px] font-medium text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-right leading-snug">{value || <span className="text-muted-foreground/60">—</span>}</span>
    </div>
  );
}
