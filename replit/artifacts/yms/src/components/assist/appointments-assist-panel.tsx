import { useState, useMemo } from "react";
import { Sparkles, ChevronDown, ChevronUp, AlertTriangle, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useProductMode } from "@/lib/product-mode";
import { getAICopy } from "@/lib/ai-copy";

interface ParsedFields {
  carrier?: string;
  date?: string;
  timeWindow?: string;
  trailer?: string;
  driver?: string;
  movement?: string;
  po?: string;
}

function parseMessageToFields(text: string): ParsedFields {
  const out: ParsedFields = {};

  const trailerMatch = text.match(/trailer\s*#?\s*([A-Z0-9\-]+)/i) || text.match(/\b([A-Z]{2,4}\d{4,6})\b/);
  if (trailerMatch) out.trailer = trailerMatch[1].toUpperCase();

  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i);
  if (dateMatch) out.date = dateMatch[0];

  const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-–to]+\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
  if (timeMatch) out.timeWindow = `${timeMatch[1]}–${timeMatch[2]}`;

  const poMatch = text.match(/(?:PO|P\.O\.)[#\s]*([A-Z0-9\-]+)/i);
  if (poMatch) out.po = poMatch[1];

  const driverMatch = text.match(/driver[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (driverMatch) out.driver = driverMatch[1];

  const mvMatch = text.match(/\b(inbound|outbound|empty\s*drop|loaded\s*arrival|live\s*load|live\s*unload)\b/i);
  if (mvMatch) out.movement = mvMatch[1].toLowerCase().replace(/\s+/g, "_");

  const carrierKeywords = ["freight", "logistics", "transport", "trucking", "carrier", "shipping"];
  for (const kw of carrierKeywords) {
    const re = new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s+${kw}`, "i");
    const m = text.match(re);
    if (m) { out.carrier = m[1]; break; }
  }

  return out;
}

function getSlotSuggestions(appointments: any[]): { label: string; reason: string; confidence: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const slotCounts: Record<string, number> = {};
  appointments.forEach((a) => {
    if (!a.scheduledDate || !a.timeWindowStart) return;
    const dateStr = a.scheduledDate.slice(0, 10);
    const key = `${dateStr}|${a.timeWindowStart}`;
    slotCounts[key] = (slotCounts[key] || 0) + 1;
  });

  const slots = [
    { time: "06:00", label: "06:00–08:00" },
    { time: "08:00", label: "08:00–10:00" },
    { time: "10:00", label: "10:00–12:00" },
    { time: "13:00", label: "13:00–15:00" },
    { time: "15:00", label: "15:00–17:00" },
  ];

  return slots
    .map((s) => {
      const key = `${tomorrowStr}|${s.time}`;
      const count = slotCounts[key] || 0;
      const confidence = Math.max(40, 95 - count * 20);
      const reason =
        count === 0
          ? "No bookings — fully open"
          : count < 2
          ? `${count} booking — low traffic`
          : count < 3
          ? `${count} bookings — moderate`
          : "Busy slot";
      return { label: `Tomorrow ${s.label}`, reason, confidence };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

function getConflictWarnings(appointments: any[]): { message: string; count: number }[] {
  const slotCounts: Record<string, { date: string; time: string; count: number }> = {};
  appointments.forEach((a) => {
    if (!a.scheduledDate || !a.timeWindowStart || ["cancelled", "no_show", "completed"].includes(a.status)) return;
    const key = `${a.scheduledDate.slice(0, 10)}|${a.timeWindowStart}`;
    if (!slotCounts[key]) slotCounts[key] = { date: a.scheduledDate.slice(0, 10), time: a.timeWindowStart, count: 0 };
    slotCounts[key].count++;
  });

  return Object.values(slotCounts)
    .filter((s) => s.count >= 3)
    .map((s) => ({
      message: `${new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${s.time}`,
      count: s.count,
    }))
    .slice(0, 3);
}

interface AppointmentsAssistPanelProps {
  appointments: any[];
  onPrefill?: (fields: ParsedFields) => void;
}

export function AppointmentsAssistPanel({ appointments, onPrefill }: AppointmentsAssistPanelProps) {
  const { mode } = useProductMode();
  const copy = getAICopy(mode);
  const [expanded, setExpanded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [parsed, setParsed] = useState<ParsedFields | null>(null);
  const [dismissedSlots, setDismissedSlots] = useState<Set<string>>(new Set());
  const [dismissedConflicts, setDismissedConflicts] = useState(false);

  const slotSuggestions = useMemo(() => getSlotSuggestions(appointments), [appointments]);
  const conflicts = useMemo(() => getConflictWarnings(appointments), [appointments]);
  const visibleConflicts = conflicts.filter(() => !dismissedConflicts);

  const handleParse = () => {
    if (!inputText.trim()) return;
    const fields = parseMessageToFields(inputText);
    setParsed(fields);
    onPrefill?.(fields);
  };

  const hasFields = parsed && Object.keys(parsed).length > 0;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 dark:border-violet-800 dark:bg-violet-950/15 overflow-hidden">
      <button
        onClick={() => setExpanded((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-violet-50/50 dark:hover:bg-violet-950/30 transition-colors"
        data-testid="assist-appointments-toggle"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[12px] font-semibold text-violet-800 dark:text-violet-200">
            {copy.badge} — Scheduling
          </span>
          {visibleConflicts.length > 0 && (
            <Badge className="h-4 px-1.5 text-[10px] bg-amber-500 text-white border-0 ml-1">
              {visibleConflicts.length} conflict{visibleConflicts.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-[10px] hidden sm:inline">{copy.reviewNote} · Slot suggestions · Email prefill</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-violet-100 dark:border-violet-900 pt-3">

          {visibleConflicts.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">
                      Slot congestion detected
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {visibleConflicts.map((c, i) => (
                        <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300">
                          {c.message} — {c.count} appointments already booked
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => setDismissedConflicts(true)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Dismiss"
                >
                  <span className="text-[10px]">✕</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Open Slot Suggestions (Tomorrow)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {slotSuggestions
                .filter((s) => !dismissedSlots.has(s.label))
                .map((s) => (
                  <div
                    key={s.label}
                    className="rounded-md border border-violet-100 dark:border-violet-800 bg-white dark:bg-violet-950/20 p-2.5 space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium">{s.label}</span>
                      <button
                        onClick={() => setDismissedSlots((prev) => new Set(prev).add(s.label))}
                        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Dismiss slot"
                      >
                        <span className="text-[10px]">✕</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.confidence >= 80 ? "bg-emerald-500" : s.confidence >= 60 ? "bg-amber-400" : "bg-slate-400"}`}
                          style={{ width: `${s.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{s.confidence}%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{s.reason}</p>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Book from Email / Message
              </span>
            </div>
            <Textarea
              placeholder="Paste a carrier email or message here, e.g. 'Trailer XTRA4821, inbound, PO-9923, arriving Jan 15 08:00–10:00, driver John Smith...'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="text-[12px] min-h-[64px] resize-none"
              data-testid="assist-message-input"
            />
            {hasFields && (
              <div className="mt-2 rounded-md border border-violet-200 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2 space-y-1">
                <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1.5">
                  Extracted fields — review before confirming
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {parsed.carrier && <p className="text-[11px]"><span className="text-muted-foreground">Carrier:</span> {parsed.carrier}</p>}
                  {parsed.trailer && <p className="text-[11px]"><span className="text-muted-foreground">Trailer:</span> {parsed.trailer}</p>}
                  {parsed.date && <p className="text-[11px]"><span className="text-muted-foreground">Date:</span> {parsed.date}</p>}
                  {parsed.timeWindow && <p className="text-[11px]"><span className="text-muted-foreground">Time:</span> {parsed.timeWindow}</p>}
                  {parsed.driver && <p className="text-[11px]"><span className="text-muted-foreground">Driver:</span> {parsed.driver}</p>}
                  {parsed.movement && <p className="text-[11px]"><span className="text-muted-foreground">Type:</span> {parsed.movement.replace(/_/g, " ")}</p>}
                  {parsed.po && <p className="text-[11px]"><span className="text-muted-foreground">PO:</span> {parsed.po}</p>}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Fields pre-filled in the booking form. Review all details before submitting.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              {parsed && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => { setParsed(null); setInputText(""); }}
                >
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleParse}
                disabled={!inputText.trim()}
                className="h-7 px-3 text-[11px] bg-violet-600 hover:bg-violet-700 text-white gap-1"
                data-testid="assist-parse-btn"
              >
                <Sparkles className="h-3 w-3" />
                Extract Fields
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
