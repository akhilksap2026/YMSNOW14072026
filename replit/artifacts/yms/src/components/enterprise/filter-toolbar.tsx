import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { SearchAutocomplete } from "./search-autocomplete";

interface FilterChip {
  label: string;
  value: string;
  onRemove: () => void;
}

interface FilterToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  suggestions?: string[];
  filters?: ReactNode;
  filterChips?: FilterChip[];
  onClearAll?: () => void;
  actions?: ReactNode;
}

export function FilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  suggestions = [],
  filters,
  filterChips,
  onClearAll,
  actions,
}: FilterToolbarProps) {
  const hasActiveFilters = filterChips && filterChips.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {onSearchChange && (
          <SearchAutocomplete
            value={searchValue ?? ""}
            onChange={onSearchChange}
            suggestions={suggestions}
            placeholder={searchPlaceholder}
            className="flex-1 min-w-[200px] max-w-sm"
            data-testid="input-filter-search"
          />
        )}
        {filters}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mr-0.5">Filters:</span>
          {filterChips.map((chip) => (
            <Badge
              key={chip.value}
              variant="secondary"
              className="h-6 pl-2 pr-1 gap-1 text-xs font-normal cursor-default"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                data-testid={`button-remove-filter-${chip.value}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              data-testid="button-clear-filters"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
