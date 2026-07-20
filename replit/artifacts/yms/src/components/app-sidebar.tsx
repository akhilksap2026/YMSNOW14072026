import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CalendarDays,
  LogIn,
  Truck,
  DoorOpen,
  ArrowRightLeft,
  AlertTriangle,
  Container,
  ClipboardList,
  ChevronDown,
  ClipboardCheck,
  ShieldCheck,
  UserCircle2,
  CheckCircle2,
  Bot,
  MapPin,
  Settings2,
  Building2,
  Bell,
  BarChart3,
  TrendingUp,
  PlayCircle,
  Mail,
  Users,
  Lock,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleColor } from "@/lib/status-colors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { Persona } from "@/App";
import { useProductMode, isStandardMode } from "@/lib/product-mode";
import { useEntitlements, moduleEnabled } from "@/lib/entitlements";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles?: string[];
  badgeKey?: string;
  aiOnly?: boolean;
  subtle?: boolean;
  secondary?: boolean;
  /** Module code from the billing catalog; item is hidden when module is not licensed. */
  module?: string;
}

const dashboardItem: NavItem = {
  title: "Dashboard",
  url: "/",
  icon: LayoutDashboard,
  // All operational roles see the dashboard; carrier excluded (carrier portal is their home)
  roles: ["admin", "yard_manager", "dock_user", "gate_guard", "yard_jockey"],
};

const operationsItems: NavItem[] = [
  // RBAC: admin+yard_manager=ALL; gate_guard=VIEW; dock_user=VIEW; carrier=VIEW
  { title: "Appointments",    url: "/appointments",   icon: CalendarDays,    roles: ["admin", "yard_manager", "gate_guard", "dock_user", "carrier"],               module: "appointments"  },
  // RBAC: admin+yard_manager=ALL; gate_guard=VCME (primary operator)
  { title: "Gate Operations", url: "/gate/check-in",  icon: LogIn,           roles: ["admin", "yard_manager", "gate_guard"], badgeKey: "gateExpected",             module: "gate"          },
  // RBAC: all operational roles have at least VIEW on yard_slot
  { title: "Yard Inventory",  url: "/yard/inventory", icon: Truck,           roles: ["admin", "yard_manager", "gate_guard", "yard_jockey", "dock_user"],           module: "yard_inventory"},
  // RBAC: admin+yard_manager=ALL; yard_jockey=VME (primary mover)
  { title: "Yard Map",        url: "/yard/map",       icon: MapPin,          roles: ["admin", "yard_manager", "yard_jockey"], secondary: true,                     module: "yard_map"      },
  // RBAC: admin+yard_manager=ALL; dock_user=VCM (primary operator)
  { title: "Dock Management", url: "/dock",           icon: DoorOpen,        roles: ["admin", "yard_manager", "dock_user"],                                        module: "dock"          },
  // RBAC: admin+yard_manager=ALL; yard_jockey=VME; dock_user=VC
  { title: "Yard Moves",      url: "/moves",          icon: ArrowRightLeft,  roles: ["admin", "yard_manager", "yard_jockey", "dock_user"], badgeKey: "movePending",module: "move_tasks"    },
];

const complianceItems: NavItem[] = [
  // RBAC: admin+yard_manager=ALL; gate_guard=VC (can raise holds); dock_user=VIEW
  { title: "Holds & Exceptions", url: "/exceptions",  icon: AlertTriangle, roles: ["admin", "yard_manager", "gate_guard", "dock_user"], badgeKey: "exceptionsOpen", module: "hold_mgmt"   },
  // RBAC: admin+yard_manager=ALL; gate_guard and dock_user perform inspections
  { title: "Inspections",        url: "/inspections",  icon: ShieldCheck,   roles: ["admin", "yard_manager", "gate_guard", "dock_user"], secondary: true,           module: "inspections" },
  // RBAC: admin+yard_manager only (audit requires modify/approve)
  { title: "Yard Audit",         url: "/yard/audit",   icon: ClipboardCheck,roles: ["admin", "yard_manager"], secondary: true,                                     module: "yard_audit"  },
];

const analyticsItems: NavItem[] = [
  // RBAC: admin=ALL; yard_manager=VIEW; dock_user=VIEW (reports module is Pro+)
  { title: "Reports & Analytics", url: "/reports",       icon: BarChart3,   roles: ["admin", "yard_manager", "dock_user"],                              module: "reports" },
  // Revenue is admin/manager-only financial data
  { title: "Revenue",             url: "/revenue",       icon: TrendingUp,  roles: ["admin", "yard_manager"], secondary: true,                          module: "reports" },
  { title: "Notifications",       url: "/notifications", icon: Bell,        badgeKey: "notificationsCount", secondary: true }, // always-on
];

const adminItems: NavItem[] = [
  { title: "Carrier Management", url: "/admin/carriers",   icon: Building2, roles: ["admin", "yard_manager"]                                                             }, // always-on
  { title: "Yard Setup",         url: "/admin/yard-setup", icon: Settings2, roles: ["admin"],              secondary: true, module: "yard_map"                          },
  { title: "Users",              url: "/admin/users",      icon: Users,     roles: ["admin"],              secondary: true, module: "user_mgmt"                         },
  { title: "Audit Log",          url: "/admin/audit",      icon: ClipboardList, roles: ["admin", "yard_manager"], secondary: true, module: "user_mgmt"                  },
  { title: "Email Intelligence", url: "/email-intelligence", icon: Mail,    roles: ["admin", "yard_manager"], aiOnly: true,  module: "ai_copilot"                       },
  { title: "Lifecycle Video",    url: "/video",            icon: PlayCircle, aiOnly: true, subtle: true                                                                  },
  { title: "AI Configuration",   url: "/admin/ai-config",  icon: Bot,       roles: ["admin"],              aiOnly: true, subtle: true, module: "ai_copilot"             },
];

export const allNavItems = [dashboardItem, ...operationsItems, ...complianceItems, ...analyticsItems, ...adminItems];

function NavItem({ item, badgeCounts }: { item: NavItem; badgeCounts?: Record<string, number> }) {
  const [location] = useLocation();
  const isActive = location === item.url ||
    (item.url === "/gate/check-in" && location === "/gate/check-out");
  const badgeCount = item.badgeKey && badgeCounts ? badgeCounts[item.badgeKey] : 0;
  const isCriticalBadge = item.badgeKey === "exceptionsOpen" && badgeCount > 0;
  const isSubtle = item.subtle && !isActive;
  const isSecondary = item.secondary && !isActive;

  return (
    <SidebarMenuItem className="relative">
      {isActive && (
        <div className="absolute left-0 top-0.5 bottom-0.5 w-[3px] rounded-r-full bg-primary z-10" />
      )}
      <SidebarMenuButton
        asChild
        data-active={isActive}
        data-testid={`nav-${item.url.replace(/\//g, "-").replace(/^-/, "")}`}
        className={`h-8 text-[13px] transition-colors ${
          isActive
            ? "text-primary font-bold bg-primary/10 pl-4"
            : isSubtle
            ? "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-accent/30"
            : isSecondary
            ? "text-sidebar-foreground/55 hover:text-sidebar-foreground/80 hover:bg-accent/40"
            : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-accent/50"
        }`}
      >
        <Link href={item.url}>
          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : isSubtle ? "opacity-40" : isSecondary ? "opacity-50" : ""}`} />
          <span className={`truncate flex-1 ${isSubtle ? "text-[12px]" : isSecondary ? "text-[12px]" : ""}`}>{item.title}</span>
          {badgeCount > 0 && (
            <Badge
              className={`ml-auto text-[10px] px-1.5 py-0 min-w-[20px] h-5 justify-center border-0 no-default-active-elevate ${
                isCriticalBadge
                  ? "bg-red-500 text-white hover:bg-red-500"
                  : "bg-primary text-primary-foreground hover:bg-primary"
              }`}
              data-testid={`badge-${item.badgeKey}`}
            >
              {badgeCount}
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * LockedNavItem — shown when the role would have access but the module is not
 * licensed for this tenant.  Communicates "upgrade to unlock" without hiding
 * the feature entirely.  RBAC-restricted items (wrong role) are fully hidden.
 */
function LockedNavItem({ item }: { item: NavItem }) {
  return (
    <SidebarMenuItem className="relative">
      <div
        className="flex items-center gap-2 h-8 px-3 rounded-md text-[13px] select-none cursor-not-allowed"
        style={{ opacity: 0.38 }}
        title={`${item.title} is not included in your current plan`}
        aria-disabled="true"
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">{item.title}</span>
        <Lock className="h-3 w-3 flex-shrink-0 ml-auto" aria-label="module locked" />
      </div>
    </SidebarMenuItem>
  );
}

function CollapsibleNavGroup({
  label,
  items,
  userRole,
  badgeCounts,
  defaultOpen = true,
  collapsible = true,
  hideAI = false,
}: {
  label: string;
  items: NavItem[];
  userRole?: string;
  badgeCounts?: Record<string, number>;
  defaultOpen?: boolean;
  collapsible?: boolean;
  hideAI?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { entitlements } = useEntitlements();

  // Hard hides: AI-only items in Standard mode, or role doesn't match at all.
  // These are invisible — the user has no concept of them.
  const roleVisible = items.filter((item) => {
    if (hideAI && item.aiOnly) return false;
    if (item.roles && userRole && !item.roles.includes(userRole)) return false;
    return true;
  });

  // Of those the role can see, split by module licensing.
  // Unlicensed → padlock (visible, upgrade affordance).
  // No module field → always available.
  const available = roleVisible.filter((item) => !item.module || moduleEnabled(entitlements, item.module));
  const locked    = roleVisible.filter((item) =>  item.module && !moduleEnabled(entitlements, item.module));

  if (available.length === 0 && locked.length === 0) return null;

  const renderItems = () => (
    <SidebarMenu className="gap-px">
      {available.map((item) => (
        <NavItem key={item.title} item={item} badgeCounts={badgeCounts} />
      ))}
      {locked.map((item) => (
        <LockedNavItem key={item.title} item={item} />
      ))}
    </SidebarMenu>
  );

  if (!collapsible) {
    return (
      <SidebarGroup className="py-1">
        <div className="flex items-center px-3 mb-0.5 py-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {label}
          </span>
        </div>
        <SidebarGroupContent>
          {renderItems()}
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarGroup className="py-1">
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center justify-between w-full px-3 mb-0.5 py-0.5 group"
            aria-label={`Toggle ${label} section`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
              {label}
            </span>
            <ChevronDown
              className={`h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-all duration-200 ${open ? "" : "-rotate-90"}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {filtered.map((item) => (
                <NavItem key={item.title} item={item} badgeCounts={badgeCounts} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function formatRole(r: string): string {
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInitials(firstName: string, lastName: string): string {
  return (firstName[0] || "") + (lastName[0] || "");
}

const ROLE_GROUPS: { key: string; label: string; roles: string[] }[] = [
  { key: "admin", label: "Administration", roles: ["admin"] },
  { key: "ops", label: "Operations", roles: ["yard_manager", "gate_guard"] },
  { key: "yard", label: "Yard Crew", roles: ["yard_jockey"] },
  { key: "dock", label: "Dock Operations", roles: ["dock_user"] },
  { key: "carrier", label: "Carrier Portal", roles: ["carrier"] },
];

function useSidebarBadgeCounts() {
  const { data } = useQuery<{
    gateStats: { expectedToday: number; checkedInToday: number };
    moveSummary: { available: number; assigned: number; inProgress: number };
    exceptionsOpen: number;
  }>({
    queryKey: ["/api/sidebar/stats"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  return {
    gateExpected: data?.gateStats?.expectedToday ?? 0,
    movePending: data?.moveSummary ? (data.moveSummary.available + data.moveSummary.assigned + data.moveSummary.inProgress) : 0,
    exceptionsOpen: data?.exceptionsOpen ?? 0,
    notificationsCount: notifications.length,
  };
}

export function AppSidebar({
  userRole,
  currentPersona,
  personas = [],
  onPersonaChange,
}: {
  userRole?: string;
  currentPersona?: Persona | null;
  personas?: Persona[];
  onPersonaChange?: (persona: Persona) => void;
}) {
  const [location] = useLocation();
  const { mode } = useProductMode();
  const hideAI = isStandardMode(mode);

  const displayName = currentPersona
    ? `${currentPersona.firstName} ${currentPersona.lastName}`
    : "Select User";

  const displayRole = currentPersona?.role || userRole;
  const displayCarrier = currentPersona?.carrierName;
  const badgeCounts = useSidebarBadgeCounts();

  const isDashboardActive = location === "/";

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-2.5 border-b border-sidebar-border">
        <div className="flex items-center justify-center">
          <img
            src="/ksap-logo.png"
            alt="KSAP"
            className="h-10 w-auto object-contain"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="py-1">
        <SidebarGroup className="py-1 px-2">
          <div className="px-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between h-auto min-h-8 py-1.5 px-2 text-xs border-dashed"
                  data-testid="button-role-selector"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {currentPersona ? (
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="text-[9px] font-bold bg-primary/15 text-primary">
                          {getInitials(currentPersona.firstName, currentPersona.lastName)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <UserCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex flex-col items-start min-w-0">
                      <span className="font-medium text-[12px] leading-tight truncate max-w-[120px]" data-testid="text-current-persona-name">
                        {displayName}
                      </span>
                      {displayRole && (
                        <span className={`inline-flex rounded px-1 py-px text-[9px] font-semibold mt-px ${roleColor(displayRole)}`}>
                          {displayCarrier ? displayCarrier.split(" ").slice(0, 2).join(" ") : formatRole(displayRole)}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-40 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64" data-testid="persona-dropdown">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Switch User / Persona
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ROLE_GROUPS.map((group) => {
                  const groupPersonas = personas.filter((p) => group.roles.includes(p.role));
                  if (groupPersonas.length === 0) return null;
                  return (
                    <div key={group.key}>
                      <DropdownMenuLabel className="text-[9px] text-muted-foreground/60 uppercase tracking-wider py-1 px-2">
                        {group.label}
                      </DropdownMenuLabel>
                      {groupPersonas.map((persona) => {
                        const isActive = currentPersona?.id === persona.id;
                        return (
                          <DropdownMenuItem
                            key={persona.id}
                            onClick={() => onPersonaChange?.(persona)}
                            data-testid={`persona-option-${persona.id}`}
                            className={`py-1.5 cursor-pointer ${isActive ? "bg-accent" : ""}`}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarFallback className={`text-[10px] font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                  {getInitials(persona.firstName, persona.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-[12px] font-medium leading-tight flex items-center gap-1">
                                  {persona.firstName} {persona.lastName}
                                  {isActive && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`inline-flex rounded px-1 py-px text-[9px] font-semibold ${roleColor(persona.role)}`}>
                                    {formatRole(persona.role)}
                                  </span>
                                  {persona.carrierName && (
                                    <span className="text-[9px] text-muted-foreground truncate">
                                      {persona.carrierName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator className="my-0.5" />
                    </div>
                  );
                })}
                {personas.length === 0 && (
                  <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    Loading users...
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarGroup>

        <SidebarGroup className="py-1 px-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              <SidebarMenuItem>
                {isDashboardActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary z-10" />
                )}
                <SidebarMenuButton
                  asChild
                  data-active={isDashboardActive}
                  data-testid="nav-"
                  className={`h-8 text-[13px] transition-colors ${isDashboardActive ? "text-primary font-bold bg-primary/10 pl-4" : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-accent/50"}`}
                >
                  <Link href="/">
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <CollapsibleNavGroup
          label="Operations"
          items={operationsItems}
          userRole={userRole}
          badgeCounts={badgeCounts}
          collapsible={false}
          hideAI={hideAI}
        />

        <CollapsibleNavGroup
          label="Compliance"
          items={complianceItems}
          userRole={userRole}
          badgeCounts={badgeCounts}
          defaultOpen={true}
          hideAI={hideAI}
        />

        <CollapsibleNavGroup
          label="Analytics"
          items={analyticsItems}
          userRole={userRole}
          badgeCounts={badgeCounts}
          defaultOpen={true}
          hideAI={hideAI}
        />

        <CollapsibleNavGroup
          label="Administration"
          items={adminItems}
          userRole={userRole}
          defaultOpen={false}
          hideAI={hideAI}
        />

      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {currentPersona && (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                {getInitials(currentPersona.firstName, currentPersona.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate leading-none" data-testid="text-user-name">
                {currentPersona.firstName} {currentPersona.lastName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {currentPersona.carrierName || formatRole(currentPersona.role)}
              </p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
