import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  maxSuggestions?: number;
  "data-testid"?: string;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder = "Search...",
  className,
  inputClassName,
  maxSuggestions = 8,
  "data-testid": testId = "input-search-autocomplete",
}: SearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.trim().length > 0
    ? suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
        .slice(0, maxSuggestions)
    : [];

  const showDropdown = open && filtered.length > 0;

  const handleSelect = useCallback((s: string) => {
    onChange(s);
    onSelect?.(s);
    setOpen(false);
    setActiveIndex(-1);
  }, [onChange, onSelect]);

  const handleClear = () => {
    onChange("");
    onSelect?.("");
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  function highlight(text: string, query: string) {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-bold text-foreground bg-yellow-100 dark:bg-yellow-900/40 rounded-sm px-0.5">
          {text.slice(idx, idx + query.length)}
        </span>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className={cn("pl-9 h-9", value ? "pr-8" : "", inputClassName)}
        data-testid={testId}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
          tabIndex={-1}
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <ul className="py-1 max-h-64 overflow-y-auto" role="listbox">
            {filtered.map((s, i) => (
              <li
                key={s}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors",
                  i === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/60"
                )}
                data-testid={`autocomplete-option-${i}`}
              >
                <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate text-muted-foreground">{highlight(s, value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
