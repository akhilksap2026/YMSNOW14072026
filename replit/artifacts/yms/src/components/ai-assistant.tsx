import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  X,
  Send,
  Truck,
  RotateCcw,
  Loader2,
  ArrowRight,
  Monitor,
  AlertTriangle,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface Action {
  type: "navigate" | "ask";
  label: string;
  path?: string;
  question?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
  actions?: Action[];
}

interface AIAssistantProps {
  currentPath: string;
  userRole: string;
}

type RiskLevel = "low" | "medium" | "high" | "critical";

interface CongestionWindow {
  riskLevel: RiskLevel;
  riskScore: number;
  factors: string[];
  impactedAreas: string[];
  recommendations: string[];
}

interface CongestionReport {
  windows: {
    now: CongestionWindow;
    thirtyMin: CongestionWindow;
    oneHour: CongestionWindow;
    shift: CongestionWindow;
  };
  currentState: {
    yardFillPct: number;
    dockUtilPct: number;
    activeTrailers: number;
    totalSlots: number;
    activeDoors: number;
    occupiedDoors: number;
    activeTasksCount: number;
    overdueTasksCount: number;
    openExceptionsCount: number;
    criticalExceptionsCount: number;
    onHoldCount: number;
    readyOutCount: number;
    waitingForDockCount: number;
  };
}

const SCREEN_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/appointments": "Appointments",
  "/gate/check-in": "Gate Check-In",
  "/gate/check-out": "Gate Check-Out",
  "/yard/inventory": "Yard Inventory",
  "/yard/map": "Yard Map",
  "/dock": "Dock Management",
  "/moves": "Yard Moves",
  "/exceptions": "Holds & Exceptions",
  "/yard/audit": "Yard Walk",
  "/inspections": "Inspections",
  "/reports": "Reports",
  "/admin/carriers": "Carriers",
  "/admin/users": "Users",
  "/admin/yard-setup": "Yard Setup",
  "/admin/audit": "Audit Log",
  "/manual": "Manual",
};

const SCREEN_SUGGESTIONS: Record<string, string[]> = {
  "/": [
    "What is the congestion risk right now?",
    "Which trailers have been here the longest?",
    "Any trailers on hold I should know about?",
    "What move tasks are overdue?",
    "Which trailers are ready to leave?",
    "What would happen if 5 more trucks arrive in the next hour?",
  ],
  "/yard/inventory": [
    "Which trailers are waiting for dock?",
    "Which trailers are overdue on dwell time?",
    "Which trailers are on hold?",
    "How many trucks are in the yard right now?",
    "Which trailers have been here the longest?",
    "What is the yard fill rate right now?",
  ],
  "/gate/check-in": [
    "How many trucks are expected today?",
    "Any walk-in trucks today?",
    "Which appointments haven't checked in yet?",
    "Which slots are available for assignment?",
    "How do I check in a truck?",
    "Are there any exceptions at the gate?",
  ],
  "/gate/check-out": [
    "Which trailers are ready to check out?",
    "Are there any hold-blocked exits?",
    "How many trailers departed today?",
    "Which trailers need seal verification?",
    "How do I complete a gate checkout?",
    "Any trailers cleared for immediate departure?",
  ],
  "/dock": [
    "What is the dock utilization rate right now?",
    "Which dock doors are available?",
    "Which trailers are waiting for dock assignment?",
    "How long have trailers been at the dock?",
    "What happens if one dock door goes offline?",
    "Which door has been occupied the longest?",
  ],
  "/moves": [
    "What are the high priority move tasks?",
    "Any overdue move tasks?",
    "What is the move task backlog?",
    "How do I create a move task?",
    "What tasks are currently unassigned?",
    "How many moves were completed today?",
  ],
  "/exceptions": [
    "What exceptions are open right now?",
    "Any critical severity exceptions?",
    "Which trailers have documentation holds?",
    "How long have these exceptions been open?",
    "What is the average exception resolution time?",
    "Which carrier has the most exceptions?",
  ],
  "/appointments": [
    "What appointments are due in the next hour?",
    "Any overdue appointments?",
    "Which carriers have appointments this afternoon?",
    "How many inbound vs outbound appointments today?",
    "What is the appointment compliance rate?",
    "Which appointments haven't checked in yet?",
  ],
  "/yard/map": [
    "Which zones have available capacity?",
    "Which zones are full?",
    "What is the yard fill rate by zone?",
    "Where should I assign the next inbound trailer?",
    "Which zone has the most trailers on hold?",
    "What is the overall yard capacity right now?",
  ],
  "/inspections": [
    "Are there any pending inspections?",
    "Any failed inspections today?",
    "What is the inspection pass rate?",
    "Which trailers need an inspection?",
    "How do I record a failed inspection?",
    "Which inspection types have the most failures?",
  ],
  "/yard/audit": [
    "Any location discrepancies in the yard?",
    "Which trailers haven't been physically verified?",
    "How do I record a yard walk finding?",
    "Are there any missing trailers in the audit?",
    "What is the current yard reconciliation status?",
    "How many audit mismatches are there?",
  ],
  "/reports": [
    "What is the average dwell time?",
    "Which carrier has the most trailers in the yard?",
    "What is the dock utilization rate?",
    "What is the exception resolution rate?",
    "Which carrier has the worst on-time performance?",
    "What is the appointment compliance rate?",
  ],
  "/admin/carriers": [
    "Which carrier has the most active trailers?",
    "What is the average dwell time by carrier?",
    "Which carrier has the most open exceptions?",
    "How many carriers are currently active in the yard?",
    "Which carrier has the best compliance rate?",
    "Which carriers have open holds right now?",
  ],
};

const PREDICTIVE_QUESTIONS = [
  "What is the congestion risk for the next hour?",
  "What happens if 10 trucks arrive in the next hour?",
  "What actions should I take to reduce congestion risk?",
  "Which area is most at risk of becoming a bottleneck?",
  "What if Dock 3 becomes unavailable?",
  "How can I improve yard throughput right now?",
];

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  gate_guard: [
    "How many trucks are expected today?",
    "Which appointments haven't checked in yet?",
    "Which trailers are ready to check out?",
    "Are there any hold-blocked exits?",
    "Which slots are available for assignment?",
    "How do I check in a truck?",
  ],
  yard_jockey: [
    "What are the high priority move tasks?",
    "Any overdue move tasks?",
    "What is the move task backlog right now?",
    "Which slots are available?",
    "Where is trailer [number] parked?",
    "How do I complete a move task?",
  ],
  dock_user: [
    "Which dock doors are available?",
    "What trailers are waiting for dock?",
    "What is the dock utilization rate?",
    "Which door has been occupied longest?",
    "What happens if a dock goes offline?",
    "How do I assign a trailer to a door?",
  ],
  carrier: [
    "What is the status of my trailer?",
    "When is my appointment today?",
    "Where is my trailer currently located?",
    "Is my trailer ready for pickup?",
    "Any issues with my trailer?",
    "How do I check in at the gate?",
  ],
};

const SCREEN_WELCOME: Record<string, string> = {
  "/": "Hi! I'm SNOW, your AI Operations Copilot.\n\nI have full access to your yard — live trailer data, move tasks, exceptions, appointments, and historical analytics. I can also **predict congestion** and recommend actions before problems occur.\n\nWhat do you need?",
  "/yard/inventory":
    "Hi! I'm SNOW. You're viewing **Yard Inventory**.\n\nI can filter trailers by status, identify dwell violations, show holds, or help you assign dock doors. I also track yard fill rate and can predict when you'll hit capacity.",
  "/gate/check-in":
    "Hi! I'm SNOW. You're at **Gate Check-In**.\n\nI can show expected arrivals, available yard slots, upcoming appointment pressure, and walk you through the check-in process.",
  "/gate/check-out":
    "Hi! I'm SNOW. You're at **Gate Check-Out**.\n\nI can show which trailers are ready to leave, flag hold-blocked exits, and guide you through the checkout process.",
  "/dock":
    "Hi! I'm SNOW. You're at **Dock Management**.\n\nI can show door availability, dock utilization rate, trailers waiting for assignment, and predict dock congestion from upcoming appointments.",
  "/moves":
    "Hi! I'm SNOW. You're viewing **Move Tasks**.\n\nI can show high-priority tasks, overdue moves, jockey workload, and estimate backlog impact on yard throughput.",
  "/exceptions":
    "Hi! I'm SNOW. You're at **Holds & Exceptions**.\n\nI can show open exceptions, resolution times, carrier exception rates, and identify which holds are blocking trailer flow.",
  "/appointments":
    "Hi! I'm SNOW. You're at **Appointments**.\n\nI can show today's schedule, upcoming arrivals in the next 30–60 minutes, compliance rates, and predict appointment-driven congestion.",
  "/yard/map":
    "Hi! I'm SNOW. You're viewing the **Yard Map**.\n\nI can tell you zone capacities, fill rates by zone, trailer locations, and recommend optimal slot assignments for incoming trailers.",
  "/inspections":
    "Hi! I'm SNOW. You're at **Inspections**.\n\nI can show pending inspections, pass/fail rates by type, and identify inspection backlogs that may be causing gate delays.",
  "/yard/audit":
    "Hi! I'm SNOW. You're at the **Yard Walk**.\n\nI can show location discrepancies, unverified trailers, and guide you through reconciling physical yard state with the system.",
  "/reports":
    "Hi! I'm SNOW. You're viewing **Reports**.\n\nI can answer questions about dwell times, carrier performance, dock utilization, exception rates, and appointment compliance — all calculated from live data.",
  "/admin/carriers":
    "Hi! I'm SNOW. You're at **Carrier Management**.\n\nI can show carrier performance stats — active trailers, average dwell, exception rates, hold frequency — across all carriers.",
};

const DEFAULT_WELCOME =
  "Hi! I'm SNOW, your AI Operations Copilot. I have full access to all yard data — trailers, move tasks, exceptions, appointments, and historical analytics. I can also predict congestion and recommend corrective actions.\n\nWhat would you like to know?";

function getSuggestions(currentPath: string, userRole: string): string[] {
  if (SCREEN_SUGGESTIONS[currentPath]) return SCREEN_SUGGESTIONS[currentPath];
  if (ROLE_SUGGESTIONS[userRole]) return ROLE_SUGGESTIONS[userRole];
  return [
    "What is the congestion risk right now?",
    "Which trailers have been here the longest?",
    "What exceptions are open?",
    "What move tasks are overdue?",
    "What is the yard fill rate?",
    "Which trailers are ready for checkout?",
  ];
}

const ACTIONS_PREFIX = "\nSNOW_ACTIONS: ";

function parseActions(raw: string): { cleanContent: string; actions: Action[] } {
  const idx = raw.lastIndexOf(ACTIONS_PREFIX);
  if (idx === -1) return { cleanContent: raw.trim(), actions: [] };
  const cleanContent = raw.slice(0, idx).trim();
  const jsonPart = raw.slice(idx + ACTIONS_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(jsonPart);
    const actions: Action[] = Array.isArray(parsed) ? parsed : [];
    return { cleanContent, actions };
  } catch {
    return { cleanContent, actions: [] };
  }
}

function boldify(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-muted-foreground mt-0.5 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(line.replace(/^[-•] /, "")) }} />
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\.\s/)?.[1];
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-muted-foreground flex-shrink-0 font-medium">{num}.</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(line.replace(/^\d+\.\s/, "")) }} />
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />;
      })}
    </div>
  );
}

function MessageBubble({
  message,
  onAction,
}: {
  message: Message;
  onAction: (action: Action) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex gap-2.5 text-sm w-full", isUser ? "flex-row-reverse" : "flex-row")}>
        {!isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
            <Bot className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        )}
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : message.error
                ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-sm"
                : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          {message.content ? (
            <FormattedMessage content={message.content} />
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking…
            </span>
          )}
          {message.streaming && message.content && (
            <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />
          )}
        </div>
        {isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center mt-0.5 text-xs font-semibold text-secondary-foreground">
            U
          </div>
        )}
      </div>
      {!isUser && !message.streaming && message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 ml-9">
          {message.actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onAction(action)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary transition-colors flex items-center gap-1 font-medium"
              data-testid={`action-btn-${action.label.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const RISK_STYLES: Record<
  Exclude<RiskLevel, "low">,
  { bar: string; badge: string; dot: string; pulse: boolean }
> = {
  medium: {
    bar: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300/50",
    dot: "bg-amber-500",
    pulse: false,
  },
  high: {
    bar: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300",
    badge: "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border-orange-300/50",
    dot: "bg-orange-500",
    pulse: true,
  },
  critical: {
    bar: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300",
    badge: "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-300/50",
    dot: "bg-red-500",
    pulse: true,
  },
};

function CongestionRiskBar({
  report,
  onAsk,
}: {
  report: CongestionReport;
  onAsk: (q: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const { windows, currentState } = report;
  const windowList = [windows.now, windows.thirtyMin, windows.oneHour];
  const worst = windowList.reduce((w, x) => (x.riskScore > w.riskScore ? x : w));

  if (worst.riskLevel === "low") return null;

  const styles = RISK_STYLES[worst.riskLevel as Exclude<RiskLevel, "low">];
  const windowLabel =
    windows.now.riskScore >= worst.riskScore
      ? "Now"
      : windows.thirtyMin.riskScore >= worst.riskScore
        ? "In 30 min"
        : "In 1 hour";

  return (
    <div className={cn("border-b shrink-0 transition-all", styles.bar)}>
      <button
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left"
        onClick={() => setCollapsed((c) => !c)}
        data-testid="congestion-risk-bar"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "h-2 w-2 rounded-full flex-shrink-0",
              styles.dot,
              styles.pulse && "animate-pulse"
            )}
          />
          <AlertTriangle className="h-3 w-3 flex-shrink-0 opacity-80" />
          <span className="text-[11px] font-bold uppercase tracking-wide flex-shrink-0">
            {worst.riskLevel} risk
          </span>
          <span className="text-[11px] opacity-60 flex-shrink-0">· {windowLabel}</span>
          {!collapsed && (
            <span className="text-[11px] truncate opacity-75 hidden sm:block">
              {worst.factors[0]}
            </span>
          )}
        </div>
        <span className="text-[10px] opacity-50 flex-shrink-0 font-medium">
          {collapsed ? "show ▾" : "hide ▴"}
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2.5 space-y-2">
          <div className="flex flex-wrap gap-1">
            {worst.factors.slice(0, 3).map((f, i) => (
              <span
                key={i}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                  styles.badge
                )}
              >
                {f}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              { label: "Yard Fill", value: `${currentState.yardFillPct}%` },
              { label: "Dock Util", value: `${currentState.dockUtilPct}%` },
              { label: "On Hold", value: `${currentState.onHoldCount}` },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={cn("rounded-lg px-2 py-1 border text-center", styles.badge)}
              >
                <p className="text-[13px] font-bold leading-tight">{kpi.value}</p>
                <p className="text-[9px] opacity-70 uppercase tracking-wide leading-tight">
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() =>
                onAsk("Explain the current congestion risk — what's driving it and how serious is it?")
              }
              className={cn(
                "flex-1 text-[11px] px-2 py-1 rounded-lg border font-medium flex items-center justify-center gap-1 hover:opacity-80 transition-opacity",
                styles.badge
              )}
              data-testid="button-explain-risk"
            >
              <TrendingUp className="h-3 w-3" />
              Explain
            </button>
            <button
              onClick={() =>
                onAsk("What specific actions should I take right now to reduce congestion risk?")
              }
              className={cn(
                "flex-1 text-[11px] px-2 py-1 rounded-lg border font-medium flex items-center justify-center gap-1 hover:opacity-80 transition-opacity",
                styles.badge
              )}
              data-testid="button-fix-risk"
            >
              <Zap className="h-3 w-3" />
              Fix it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AIAssistant({ currentPath, userRole }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPredictive, setShowPredictive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [, setLocation] = useLocation();

  const { data: aiConfig } = useQuery<{ copilotEnabled: boolean; chatAssistantEnabled: boolean; predictiveOpsEnabled: boolean }>({
    queryKey: ["/api/ai-config"],
    staleTime: 30_000,
  });

  const screenName = SCREEN_NAMES[currentPath || "/"] || "YardNow";
  const safeRole = userRole || "admin";
  const suggestions = getSuggestions(currentPath || "/", safeRole);

  const { data: dashStats } = useQuery<{
    yardInventory: number; trailersAtDock: number; trailersOnHold: number;
    agedTrailers: number; overdueMoves: number; openMoveTasks: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: 60_000,
    enabled: isOpen,
  });

  const contextualPrompts = (() => {
    const base = [
      "Summarise today's yard operations so far",
      "What are the oldest trailers in the yard right now?",
    ];
    const dynamic: string[] = [];
    if (dashStats) {
      if (dashStats.agedTrailers > 0)
        dynamic.push(`Which trailers have been waiting over 4 h? What should I do?`);
      if (dashStats.overdueMoves > 0)
        dynamic.push("Which move tasks are overdue and who should I reassign them to?");
      if (dashStats.trailersOnHold > 0)
        dynamic.push("What holds need to be resolved today? Give me a priority order.");
      if (dashStats.trailersAtDock > 3)
        dynamic.push("Are any dock doors running behind schedule? Which ones need attention?");
    }
    return [...base, ...dynamic].slice(0, 6);
  })();

  const { data: congestionReport } = useQuery<CongestionReport>({
    queryKey: ["/api/assistant/congestion"],
    refetchInterval: aiConfig?.predictiveOpsEnabled !== false ? 60_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    enabled: aiConfig?.predictiveOpsEnabled !== false,
  });

  const worstRisk: RiskLevel = congestionReport
    ? [
        congestionReport.windows.now,
        congestionReport.windows.thirtyMin,
        congestionReport.windows.oneHour,
      ].reduce((w, x) => (x.riskScore > w.riskScore ? x : w)).riskLevel
    : "low";

  const fabRingColor =
    worstRisk === "critical"
      ? "ring-4 ring-red-500/50"
      : worstRisk === "high"
        ? "ring-4 ring-orange-400/50"
        : worstRisk === "medium"
          ? "ring-2 ring-amber-400/50"
          : "";

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcome = SCREEN_WELCOME[currentPath] || DEFAULT_WELCOME;
      setMessages([{ id: "welcome", role: "assistant", content: welcome }]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const isWelcome =
        messages.length === 1 && messages[0].id === "welcome";
      if (isWelcome) {
        const welcome = SCREEN_WELCOME[currentPath] || DEFAULT_WELCOME;
        setMessages([{ id: "welcome", role: "assistant", content: welcome }]);
      }
    }
  }, [currentPath]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setShowPredictive(false);

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const assistantId = `a-${Date.now()}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);
      scrollToBottom();

      const history = messages
        .filter((m) => !["welcome", "welcome-new"].includes(m.id) && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        abortRef.current = new AbortController();
        const response = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history,
            screenContext: {
              currentPath: currentPath || "/",
              screenName,
              userRole: safeRole,
            },
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) throw new Error("Request failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulated += data.content;
                const displayContent = accumulated.includes(
                  "\nSNOW_ACTIONS: "
                )
                  ? accumulated
                      .slice(0, accumulated.lastIndexOf("\nSNOW_ACTIONS: "))
                      .trim()
                  : accumulated;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: displayContent }
                      : m
                  )
                );
                scrollToBottom();
              }
              if (data.done) {
                const { cleanContent, actions } = parseActions(accumulated);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: cleanContent, streaming: false, actions }
                      : m
                  )
                );
              }
              if (data.error) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: "Sorry, I ran into an error. Please try again.",
                          streaming: false,
                          error: true,
                        }
                      : m
                  )
                );
              }
            } catch {}
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Sorry, I couldn't connect. Please try again.",
                    streaming: false,
                    error: true,
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.streaming ? { ...m, streaming: false } : m
          )
        );
      }
    },
    [isStreaming, messages, scrollToBottom, currentPath, screenName, userRole]
  );

  const handleAction = useCallback(
    (action: Action) => {
      if (action.type === "navigate" && action.path) {
        setLocation(action.path);
        setIsOpen(false);
      } else if (action.type === "ask" && action.question) {
        sendMessage(action.question);
      }
    },
    [setLocation, sendMessage]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    const welcome = SCREEN_WELCOME[currentPath] || DEFAULT_WELCOME;
    setMessages([{ id: "welcome-new", role: "assistant", content: welcome }]);
    setIsStreaming(false);
    setShowPredictive(false);
  };

  const hasConversation =
    messages.filter((m) => m.id !== "welcome" && m.id !== "welcome-new").length > 0;

  const roleLabel = safeRole
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (aiConfig && !aiConfig.copilotEnabled) return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 h-14 w-14">
        <button
          onClick={() => setIsOpen((o) => !o)}
          title="SNOW AI Operations Copilot"
          data-testid="button-ai-assistant"
          className={cn(
            "h-full w-full rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary relative",
            !isOpen && fabRingColor,
            isOpen
              ? "bg-primary scale-95"
              : "bg-primary hover:bg-primary/90 hover:scale-105"
          )}
          style={isOpen ? {} : { animation: "truckPulse 2.8s ease-in-out infinite" }}
        >
          {isOpen ? (
            <X className="h-5 w-5 text-primary-foreground" />
          ) : (
            <Truck className="h-6 w-6 text-primary-foreground" />
          )}
          {!isOpen && (worstRisk === "critical" || worstRisk === "high") && (
            <span
              className={cn(
                "absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                worstRisk === "critical" ? "bg-red-500" : "bg-orange-500"
              )}
              data-testid="risk-indicator"
            />
          )}
          {!isOpen && worstRisk === "low" && hasConversation && (
            <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-green-400 border-2 border-primary" />
          )}
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none"
          style={{ paddingBottom: "5.5rem", paddingRight: "1rem" }}
          data-testid="ai-assistant-panel"
        >
          <div
            className="pointer-events-auto flex flex-col rounded-2xl border bg-background shadow-2xl w-[440px] h-[640px] max-h-[calc(100vh-7rem)] overflow-hidden"
            style={{ animation: "slideInUp 0.22s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm leading-none">SNOW</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    AI Operations Copilot
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] h-4 px-1.5 bg-green-500/10 text-green-600 border-green-500/20"
                >
                  Live Data
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {hasConversation && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={clearChat}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Clear chat"
                    data-testid="button-clear-chat"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  data-testid="button-close-assistant"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="px-4 py-1.5 border-b bg-muted/20 shrink-0 flex items-center gap-2">
              <Monitor className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground font-medium">
                {screenName}
              </span>
              <span className="text-muted-foreground/40 text-[11px]">·</span>
              <span className="text-[11px] text-muted-foreground/70">
                {roleLabel}
              </span>
            </div>

            {congestionReport && (
              <CongestionRiskBar
                report={congestionReport}
                onAsk={sendMessage}
              />
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} onAction={handleAction} />
              ))}
            </div>

            {!hasConversation && (
              <div className="px-4 pb-2 shrink-0 space-y-2">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
                    Suggested for this yard state
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {contextualPrompts.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        disabled={isStreaming}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed leading-tight"
                        data-testid={`contextual-${q.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                {suggestions.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
                    Suggested for this screen
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.slice(0, 4).map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        disabled={isStreaming}
                        className="text-[11px] px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid={`suggestion-${q.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                )}

                <div>
                  <button
                    className="text-[11px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => setShowPredictive((p) => !p)}
                    data-testid="button-toggle-predictive"
                  >
                    <Zap className="h-2.5 w-2.5" />
                    AI Insights {showPredictive ? "▴" : "▾"}
                  </button>
                  {showPredictive && (
                    <div className="flex flex-wrap gap-1.5">
                      {PREDICTIVE_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          disabled={isStreaming}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary transition-colors text-left disabled:opacity-50"
                          data-testid={`predictive-${q.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasConversation && !isStreaming && (
              <div className="px-4 pb-1 shrink-0">
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                  {suggestions.slice(0, 3).map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-[10px] px-2 py-0.5 rounded-full border bg-background hover:bg-muted transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      {q}
                    </button>
                  ))}
                  {PREDICTIVE_QUESTIONS.slice(0, 2).map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 pb-4 pt-2 border-t shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask about ${screenName.toLowerCase()}…`}
                  className="min-h-[40px] max-h-[120px] resize-none text-sm py-2.5 px-3 rounded-xl"
                  rows={1}
                  disabled={isStreaming}
                  data-testid="input-assistant-message"
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isStreaming}
                  className="h-10 w-10 rounded-xl flex-shrink-0"
                  data-testid="button-send-message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes truckPulse {
          0%,  100% { box-shadow: 0 10px 25px rgba(0,0,0,0.25), 0 0 0 0 rgba(99,102,241,0.15); }
          50%        { box-shadow: 0 14px 30px rgba(0,0,0,0.20), 0 0 0 8px rgba(99,102,241,0); }
        }
      `}</style>
    </>
  );
}
