import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/lib/theme-provider";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar, allNavItems } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, RotateCcw, ChevronRight, Bell, Shield, LogOut, Building2 } from "lucide-react";
import { TabletViewProvider, useTabletView } from "@/lib/tablet-view";
import { TabletToggle } from "@/components/tablet-toggle";
import { AIAssistant } from "@/components/ai-assistant";
import { EmailInboxPanel, EmailInboxTrigger } from "@/components/email-inbox-panel";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, storeCurrentRole } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { ProductModeProvider, useProductMode, showAIRecommendations } from "@/lib/product-mode";
import { ModeSelector } from "@/components/mode-selector";
import { EntitlementsProvider, useEntitlements, moduleEnabled } from "@/lib/entitlements";
import { ErrorBoundary } from "@/components/error-boundary";

function TabletSidebarSync() {
  const { tabletMode } = useTabletView();
  const { setOpen } = useSidebar();
  useEffect(() => {
    setOpen(!tabletMode);
  }, [tabletMode, setOpen]);
  return null;
}

const SHIFT_START_KEY = "ymsnow_shift_start";

function useShiftClock() {
  const [elapsed, setElapsed] = useState("");
  const [shiftStart, setShiftStart] = useState("");

  useEffect(() => {
    let startTs = sessionStorage.getItem(SHIFT_START_KEY);
    if (!startTs) {
      startTs = new Date().toISOString();
      sessionStorage.setItem(SHIFT_START_KEY, startTs);
    }
    const start = new Date(startTs);
    const hhmm = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    setShiftStart(hhmm);

    const calc = () => {
      const mins = Math.floor((Date.now() - start.getTime()) / 60000);
      if (mins < 60) setElapsed(`${mins}m`);
      else setElapsed(`${Math.floor(mins / 60)}h ${mins % 60}m`);
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, []);

  return { shiftStart, elapsed };
}

function ShiftClock() {
  const { shiftStart, elapsed } = useShiftClock();
  if (!shiftStart) return null;
  return (
    <span className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1 whitespace-nowrap" data-testid="shift-clock">
      <Shield className="h-3 w-3 opacity-50" />
      Shift {shiftStart} · {elapsed} elapsed
    </span>
  );
}

const DashboardPage     = lazy(() => import("@/pages/dashboard"));
const AppointmentsPage  = lazy(() => import("@/pages/appointments"));
const GateCheckInPage   = lazy(() => import("@/pages/gate-checkin"));
const GateCheckOutPage  = lazy(() => import("@/pages/gate-checkout"));
const YardInventoryPage = lazy(() => import("@/pages/yard-inventory"));
const YardMapPage       = lazy(() => import("@/pages/yard-map"));
const DockManagementPage = lazy(() => import("@/pages/dock-management"));
const MoveTasksPage     = lazy(() => import("@/pages/move-tasks"));
const ExceptionsPage    = lazy(() => import("@/pages/exceptions"));
const AdminCarriersPage = lazy(() => import("@/pages/admin-carriers"));
const AdminYardSetupPage = lazy(() => import("@/pages/admin-yard-setup"));
const AdminUsersPage    = lazy(() => import("@/pages/admin-users"));
const AdminAuditPage    = lazy(() => import("@/pages/admin-audit"));
const YardAuditPage     = lazy(() => import("@/pages/yard-audit"));
const InspectionsPage   = lazy(() => import("@/pages/inspections"));
const ReportsPage       = lazy(() => import("@/pages/reports"));
const AdminAiConfigPage = lazy(() => import("@/pages/admin-ai-config"));
const RevenuePage       = lazy(() => import("@/pages/revenue"));
const EmailIntelligencePage  = lazy(() => import("@/pages/email-intelligence"));
const PlatformAdminPage        = lazy(() => import("@/pages/platform-admin"));
const PlatformTenantDetailPage = lazy(() => import("@/pages/platform-tenant-detail"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const GateGuardPage     = lazy(() => import("@/pages/gate-guard"));
const CarrierPortalPage = lazy(() => import("@/pages/carrier-portal"));
const TruckLifecycleVideoPage = lazy(() => import("@/pages/truck-lifecycle-video"));

export interface Persona {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  carrierId: number | null;
  carrierName: string | null;
  isActive: boolean;
}

const PERSONA_KEY = "ymsnow_persona_id";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
      className="h-8 w-8"
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}

function Breadcrumbs() {
  const [location] = useLocation();
  const current = allNavItems.find((item) => item.url === location);

  const groupLabel = (() => {
    const ops = ["Dashboard", "Appointments", "Gate Check-In", "Gate Check-Out", "Inspections", "Yard Inventory", "Yard Map"];
    const wf = ["Dock Management", "Move Tasks", "Holds & Exceptions", "Yard Walk", "Email Intelligence"];
    const analytics = ["Reports & Analytics"];
    const admin = ["Carrier Management", "Yard Setup", "Users", "Audit Log", "AI Console"];
    if (!current) return null;
    if (ops.includes(current.title)) return "Operations";
    if (wf.includes(current.title)) return "Workflow";
    if (analytics.includes(current.title)) return "Analytics";
    if (admin.includes(current.title)) return "Administration";
    return null;
  })();

  if (!current) return null;

  return (
    <nav className="flex items-center gap-1 text-sm" data-testid="nav-breadcrumbs">
      {groupLabel && (
        <span className="hidden sm:inline-flex items-center gap-1">
          <span className="text-muted-foreground/60 text-xs font-medium">{groupLabel}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        </span>
      )}
      <span className="font-medium text-foreground text-xs truncate max-w-[140px] sm:max-w-none">{current.title}</span>
    </nav>
  );
}

function RoleGuard({ children, allowedRoles, userRole }: { children: React.ReactNode; allowedRoles?: string[]; userRole?: string }) {
  if (!allowedRoles) return <>{children}</>;
  if (!userRole) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }
  if (allowedRoles.includes(userRole)) return <>{children}</>;
  return <Redirect to="/" />;
}

/**
 * Combines module entitlement check + RBAC role check.
 * If the module is not licensed for this tenant, redirects to "/" with a toast.
 * Falls through to RoleGuard for permission-based access control.
 */
function ModuleGuard({
  module: moduleCode,
  allowedRoles,
  userRole,
  children,
}: {
  module?: string;
  allowedRoles?: string[];
  userRole?: string;
  children: React.ReactNode;
}) {
  const { entitlements, isLoading } = useEntitlements();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const locked = !isLoading && moduleCode != null && !moduleEnabled(entitlements, moduleCode);

  useEffect(() => {
    if (locked) {
      toast({
        title: "Not included in your plan",
        description: "This module is not available on your current subscription.",
      });
      navigate("/");
    }
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (locked) return null;
  return (
    <RoleGuard allowedRoles={allowedRoles} userRole={userRole}>
      {children}
    </RoleGuard>
  );
}

function AppRouter({ userRole, currentPersona }: { userRole?: string; currentPersona?: Persona | null }) {
  return (
    <Switch>
      {/* ── Always-accessible ─────────────────────────────────────────────── */}
      <Route path="/">
        <DashboardPage userRole={userRole} />
      </Route>
      <Route path="/notifications">
        <NotificationsPage />
      </Route>
      <Route path="/admin/carriers">
        <RoleGuard allowedRoles={["admin", "yard_manager"]} userRole={userRole}>
          <AdminCarriersPage />
        </RoleGuard>
      </Route>

      {/* ── Module-gated routes ───────────────────────────────────────────── */}
      <Route path="/appointments">
        <ModuleGuard module="appointments" userRole={userRole}>
          <AppointmentsPage userRole={userRole} currentPersona={currentPersona} />
        </ModuleGuard>
      </Route>
      <Route path="/gate/check-in">
        <ModuleGuard module="gate" allowedRoles={["admin", "yard_manager", "gate_guard"]} userRole={userRole}>
          <GateCheckInPage />
        </ModuleGuard>
      </Route>
      <Route path="/gate/check-out">
        <ModuleGuard module="gate" allowedRoles={["admin", "yard_manager", "gate_guard"]} userRole={userRole}>
          <GateCheckOutPage />
        </ModuleGuard>
      </Route>
      <Route path="/gate/guard-mode">
        <ModuleGuard module="gate" allowedRoles={["admin", "yard_manager", "gate_guard"]} userRole={userRole}>
          <GateGuardPage />
        </ModuleGuard>
      </Route>
      <Route path="/yard/inventory">
        <ModuleGuard module="yard_inventory" allowedRoles={["admin", "yard_manager", "gate_guard", "yard_jockey", "dock_user"]} userRole={userRole}>
          <YardInventoryPage userRole={userRole} />
        </ModuleGuard>
      </Route>
      <Route path="/yard/map">
        <ModuleGuard module="yard_map" allowedRoles={["admin", "yard_manager", "yard_jockey"]} userRole={userRole}>
          <YardMapPage />
        </ModuleGuard>
      </Route>
      <Route path="/dock">
        <ModuleGuard module="dock" allowedRoles={["admin", "yard_manager", "dock_user"]} userRole={userRole}>
          <DockManagementPage userRole={userRole} currentPersona={currentPersona} />
        </ModuleGuard>
      </Route>
      <Route path="/moves">
        <ModuleGuard module="move_tasks" allowedRoles={["admin", "yard_manager", "yard_jockey"]} userRole={userRole}>
          <MoveTasksPage userRole={userRole} currentPersonaId={currentPersona?.id} />
        </ModuleGuard>
      </Route>
      <Route path="/exceptions">
        <ModuleGuard module="hold_mgmt" allowedRoles={["admin", "yard_manager"]} userRole={userRole}>
          <ExceptionsPage />
        </ModuleGuard>
      </Route>
      <Route path="/inspections">
        <ModuleGuard module="inspections" allowedRoles={["admin", "yard_manager", "gate_guard", "dock_user"]} userRole={userRole}>
          <InspectionsPage userRole={userRole} currentPersona={currentPersona} />
        </ModuleGuard>
      </Route>
      <Route path="/yard/audit">
        <ModuleGuard module="yard_audit" allowedRoles={["admin", "yard_manager"]} userRole={userRole}>
          <YardAuditPage />
        </ModuleGuard>
      </Route>
      <Route path="/reports">
        <ModuleGuard module="reports" allowedRoles={["admin", "yard_manager"]} userRole={userRole}>
          <ReportsPage />
        </ModuleGuard>
      </Route>
      <Route path="/revenue">
        <ModuleGuard module="reports" allowedRoles={["admin", "yard_manager"]} userRole={userRole}>
          <RevenuePage />
        </ModuleGuard>
      </Route>
      <Route path="/admin/yard-setup">
        <ModuleGuard module="yard_map" allowedRoles={["admin"]} userRole={userRole}>
          <AdminYardSetupPage />
        </ModuleGuard>
      </Route>
      <Route path="/admin/users">
        <ModuleGuard module="user_mgmt" allowedRoles={["admin"]} userRole={userRole}>
          <AdminUsersPage />
        </ModuleGuard>
      </Route>
      <Route path="/admin/audit">
        <ModuleGuard module="user_mgmt" allowedRoles={["admin", "yard_manager"]} userRole={userRole}>
          <AdminAuditPage />
        </ModuleGuard>
      </Route>
      <Route path="/admin/ai-config">
        <ModuleGuard module="ai_copilot" allowedRoles={["admin"]} userRole={userRole}>
          <AdminAiConfigPage />
        </ModuleGuard>
      </Route>
      <Route path="/email-intelligence">
        <ModuleGuard module="ai_copilot" allowedRoles={["admin", "yard_manager"]} userRole={userRole}>
          <EmailIntelligencePage />
        </ModuleGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useQuery<{ id: string; role: string }>({
    queryKey: ["/api/user/profile"],
  });

  const { entitlements } = useEntitlements();

  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ["/api/admin/users"],
    select: (data: any[]) => data.filter((u) => u.id !== "demo-user" && u.isActive),
    // Only fetch when user_mgmt is licensed; /api/admin/users returns 403 otherwise
    enabled: moduleEnabled(entitlements, "user_mgmt"),
  });

  const [currentPersonaId, setCurrentPersonaId] = useState<string>(() => {
    return localStorage.getItem(PERSONA_KEY) || "demo-admin-001";
  });

  const currentPersona = personas.find((p) => p.id === currentPersonaId) ?? null;

  useEffect(() => {
    localStorage.setItem(PERSONA_KEY, currentPersonaId);
  }, [currentPersonaId]);

  useEffect(() => {
    if (currentPersona?.role) {
      storeCurrentRole(currentPersona.role);
    }
  }, [currentPersona?.role]);

  const changeRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      if (!user) return;
      await apiRequest("PATCH", `/api/admin/users/${user.userId}/role`, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to change role.", variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/reset-to-seed");
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCurrentPersonaId("demo-admin-001");
      localStorage.setItem(PERSONA_KEY, "demo-admin-001");
      toast({ title: "Data reset", description: "All data has been restored to its original demo state." });
    },
    onError: () => {
      toast({ title: "Reset failed", description: "Could not reset the database.", variant: "destructive" });
    },
  });

  const handlePersonaChange = (persona: Persona) => {
    setCurrentPersonaId(persona.id);
    storeCurrentRole(persona.role);
    if (persona.role !== profile?.role) {
      changeRoleMutation.mutate(persona.role);
    } else {
      toast({
        title: `Switched to ${persona.firstName} ${persona.lastName}`,
        description: persona.carrierName
          ? `${persona.carrierName} — Carrier Portal`
          : persona.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }
  };

  const { mode } = useProductMode();
  const aiModeEnabled = showAIRecommendations(mode);

  const { data: aiConfig } = useQuery<{ copilotEnabled: boolean }>({
    queryKey: ["/api/ai-config"],
    select: (d: any) => ({ copilotEnabled: d.copilotEnabled }),
    // Only fetch when ai_copilot is licensed; /api/ai-config returns 403 otherwise
    enabled: moduleEnabled(entitlements, "ai_copilot"),
  });
  const aiEnabled = aiConfig?.copilotEnabled !== false && aiModeEnabled;

  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const { data: emailAlerts = [] } = useQuery<{ id: number; alertStatus: string }[]>({
    queryKey: ["/api/email-intelligence/alerts"],
    select: (d: any[]) => d.filter((a) => a.alertStatus === "new"),
    enabled: aiEnabled,
  });

  const { data: notifData = [] } = useQuery<{ id: string; severity: string; isRead?: boolean }[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60_000,
  });
  const notificationCount = notifData.length;
  const unreadNotifs = notifData.filter((n) => !n.isRead);
  const maxSeverity = unreadNotifs.some((n) => n.severity === "critical" || n.severity === "high")
    ? "critical"
    : unreadNotifs.some((n) => n.severity === "medium")
    ? "medium"
    : "low";
  const bellBadgeColor = notificationCount > 0
    ? maxSeverity === "critical" ? "bg-[#E24B4A] animate-pulse" : maxSeverity === "medium" ? "bg-[#BA7517]" : "bg-primary"
    : "bg-primary";

  const [location, navigate] = useLocation();

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        navigate("/gate/check-in");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('[data-testid*="search"], [placeholder*="Search"]');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [navigate]);

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  const userRole = profile?.role;

  if (location === "/gate/guard-mode") {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><Skeleton className="h-32 w-64 mx-auto mt-20" /></div>}>
        <GateGuardPage />
      </Suspense>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <TabletSidebarSync />
      <div className="flex h-screen w-full">
        <AppSidebar
          userRole={userRole}
          currentPersona={currentPersona}
          personas={personas}
          onPersonaChange={handlePersonaChange}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-3 px-3 h-11 border-b bg-background/80 backdrop-blur-sm shrink-0 z-10">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="h-7 w-7" />
              <Separator orientation="vertical" className="h-4" />
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-1.5">
              <ShiftClock />
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <ModeSelector />
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <TabletToggle />
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                data-testid="button-reset-data"
                className="text-[11px] h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className={`h-3 w-3 ${resetMutation.isPending ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{resetMutation.isPending ? "Resetting..." : "Reset"}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate("/notifications")}
                className="relative h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                data-testid="button-notifications"
                title="Notifications"
              >
                <Bell className="h-3.5 w-3.5" />
                {notificationCount > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ${bellBadgeColor} text-[9px] text-white flex items-center justify-center font-bold leading-none`}>
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </Button>
              {(userRole === "admin" || userRole === "yard_manager") && aiEnabled && (
                <EmailInboxTrigger
                  onClick={() => setEmailPanelOpen((o) => !o)}
                  alertCount={emailAlerts.length}
                />
              )}
              <ThemeToggle />
              <Button
                size="icon"
                variant="ghost"
                onClick={onLogout}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Suspense fallback={
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64 w-full" />
              </div>
            }>
              <AppRouter userRole={userRole} currentPersona={currentPersona} />
            </Suspense>
          </main>
        </div>
      </div>
      {aiEnabled && <AIAssistant currentPath={location} userRole={userRole || "admin"} />}
      {(userRole === "admin" || userRole === "yard_manager") && aiEnabled && (
        <EmailInboxPanel isOpen={emailPanelOpen} onClose={() => setEmailPanelOpen(false)} />
      )}
    </SidebarProvider>
  );
}

/**
 * Minimal shell rendered for isPlatformAdmin sessions.
 * Completely separate from AuthenticatedApp — no tenant sidebar, no module guards.
 */
function PlatformAdminShell({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b h-11 flex items-center justify-between px-5 shrink-0 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold tracking-tight">KSAP</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5">
            Platform Admin
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onLogout}
          className="h-7 text-xs text-muted-foreground gap-1.5"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </Button>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          <Suspense fallback={
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          }>
            <Switch>
              <Route path="/platform/tenants/:id">
                {(params: { id: string }) => (
                  <PlatformTenantDetailPage tenantId={params.id} />
                )}
              </Route>
              <Route>
                <PlatformAdminPage />
              </Route>
            </Switch>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function AppGate() {
  const { user, isLoading } = useAuth();

  // Keep the x-user-role header in sync so existing RBAC middleware keeps working
  useEffect(() => {
    if (user) storeCurrentRole(user.role);
  }, [user?.role]);

  const handleLogin = (userId: string, role: string) => {
    // login.tsx already called POST /api/auth/login and storeCurrentRole
    localStorage.setItem(PERSONA_KEY, userId);
    if (role === "carrier") {
      window.location.replace("/portal");
      return;
    }
    // Invalidate the me-query so useAuth re-fetches and transitions to authenticated state
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const handleLogout = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch { /* ignore */ }
    sessionStorage.removeItem(SHIFT_START_KEY);
    // Immediately clear the cached identity so the login page renders at once
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.clear();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-32 w-64 mx-auto mt-20" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (user.isPlatformAdmin) {
    return <PlatformAdminShell onLogout={handleLogout} />;
  }

  return <AuthenticatedApp onLogout={handleLogout} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProductModeProvider>
      <EntitlementsProvider>
      <TabletViewProvider>
      <ThemeProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <Switch>
              <Route path="/portal">
                <Suspense fallback={<div className="flex items-center justify-center h-screen"><Skeleton className="h-32 w-64 mx-auto mt-20" /></div>}>
                  <CarrierPortalPage />
                </Suspense>
              </Route>
              <Route path="/video">
                <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[#0f172a]"><Skeleton className="h-32 w-64 mx-auto mt-20" /></div>}>
                  <TruckLifecycleVideoPage />
                </Suspense>
              </Route>
              <Route>
                <AppGate />
              </Route>
            </Switch>
            <Toaster />
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
      </TabletViewProvider>
      </EntitlementsProvider>
      </ProductModeProvider>
    </QueryClientProvider>
  );
}
