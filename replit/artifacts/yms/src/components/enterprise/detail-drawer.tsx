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
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          {subtitle && <SheetDescription className="text-sm text-muted-foreground">{subtitle}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <div className="border-t px-5 py-3 shrink-0 bg-muted/30">
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
    <div className={`space-y-2 ${className}`}>
      {title && (
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      )}
      {children}
    </div>
  );
}

interface DrawerFieldProps {
  label: string;
  value: ReactNode;
}

export function DrawerField({ label, value }: DrawerFieldProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}
