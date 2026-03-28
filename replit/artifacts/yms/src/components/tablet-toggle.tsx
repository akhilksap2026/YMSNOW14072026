import { Monitor, Tablet } from "lucide-react";
import { useTabletView } from "@/lib/tablet-view";
import { cn } from "@/lib/utils";

export function TabletToggle() {
  const { tabletMode, setTabletMode } = useTabletView();

  return (
    <div
      className="flex items-center rounded border border-border bg-muted/40 p-0.5 gap-0 shrink-0"
      title={tabletMode ? "Switch to Desktop view" : "Switch to Tablet view"}
    >
      <button
        onClick={() => setTabletMode(false)}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all",
          !tabletMode
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        data-testid="button-view-desktop"
      >
        <Monitor className="h-3 w-3 shrink-0" />
        <span className="hidden sm:inline">Desktop</span>
      </button>
      <button
        onClick={() => setTabletMode(true)}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all",
          tabletMode
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        data-testid="button-view-tablet"
      >
        <Tablet className="h-3 w-3 shrink-0" />
        <span className="hidden sm:inline">Tablet</span>
      </button>
    </div>
  );
}
