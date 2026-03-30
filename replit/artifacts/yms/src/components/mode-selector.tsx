import { Sparkles } from "lucide-react";
import { useProductMode, MODE_CONFIG, type ProductMode } from "@/lib/product-mode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const MODES: ProductMode[] = ["core", "elevate", "enhanced"];

export function ModeSelector() {
  const { mode, setMode } = useProductMode();
  const cfg = MODE_CONFIG[mode];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 px-2 gap-1.5 text-[11px] font-semibold border rounded-full transition-colors ${cfg.badgeClass}`}
          data-testid="button-mode-selector"
        >
          {mode !== "core" && <Sparkles className="h-2.5 w-2.5" />}
          {cfg.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Platform Mode
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODES.map((m) => {
          const c = MODE_CONFIG[m];
          const isActive = mode === m;
          return (
            <DropdownMenuItem
              key={m}
              onClick={() => setMode(m)}
              data-testid={`mode-option-${m}`}
              className="cursor-pointer flex flex-col items-start gap-0.5 py-2"
            >
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? c.activeClass : c.badgeClass}`}>
                {m !== "core" && <Sparkles className="h-2.5 w-2.5" />}
                {c.label}
                {isActive && <span className="ml-1 opacity-70">✓</span>}
              </span>
              <span className="text-[10px] text-muted-foreground pl-0.5 leading-snug">
                {c.description}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ModeBadge() {
  const { mode } = useProductMode();
  if (mode === "core") return null;
  const cfg = MODE_CONFIG[mode];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.badgeClass}`}>
      <Sparkles className="h-2.5 w-2.5" />
      {cfg.label} Mode
    </span>
  );
}
