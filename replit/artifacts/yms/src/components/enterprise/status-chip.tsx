import { Badge } from "@/components/ui/badge";

interface StatusChipProps {
  status: string;
  colorFn: (status: string) => string;
  label?: string;
  size?: "sm" | "default";
  className?: string;
  "data-testid"?: string;
}

function formatLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusChip({ status, colorFn, label, size = "default", className = "", ...props }: StatusChipProps) {
  const sizeClass = size === "sm" ? "text-[10px] h-5 px-1.5" : "text-xs h-[22px] px-2";
  return (
    <Badge
      className={`${colorFn(status)} border-transparent font-medium no-default-hover-elevate ${sizeClass} ${className}`}
      data-testid={props["data-testid"]}
    >
      {label || formatLabel(status)}
    </Badge>
  );
}
