/**
 * Platform Admin — Tenant Management
 * Visible only to isPlatformAdmin users; rendered by PlatformAdminShell in App.tsx.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Building2, RefreshCw, PauseCircle, PlayCircle, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string | null;
  subscriptionStatus: string | null;
  planCode: string | null;
  planName: string | null;
}

interface CreateForm {
  name: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminUserId: string;
}

const EMPTY_FORM: CreateForm = {
  name: "",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminUserId: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">—</Badge>;
  const isSuspended = status === "suspended";
  return (
    <Badge
      className={`text-[11px] px-2 py-0.5 font-semibold border-0 ${
        isSuspended
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      }`}
    >
      {status}
    </Badge>
  );
}

function PlanBadge({ code, name }: { code: string | null; name: string | null }) {
  if (!code) return <span className="text-muted-foreground text-sm">—</span>;
  const colors: Record<string, string> = {
    core:         "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    professional: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    enterprise:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${colors[code] ?? "bg-muted text-muted-foreground"}`}>
      {name ?? code}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PlatformAdminPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  // List tenants
  const {
    data: tenants = [],
    isLoading,
    refetch,
  } = useQuery<TenantRow[]>({
    queryKey: ["/api/platform/tenants"],
    staleTime: 10_000,
  });

  // Create tenant
  const createMutation = useMutation({
    mutationFn: (body: Omit<CreateForm, "adminUserId"> & { adminUserId?: string }) =>
      apiRequest("POST", "/api/platform/tenants", body).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/tenants"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast({
        title: "Tenant created",
        description: `"${data.name}" is ready. Admin user ID: ${data.adminUserId}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    },
  });

  // Suspend / reactivate
  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/platform/tenants/${id}`, { status }).then((r) => r.json()),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/tenants"] });
      toast({
        title: vars.status === "suspended" ? "Tenant suspended" : "Tenant reactivated",
        description: "All entitlement caches have been cleared.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.adminFirstName.trim() || !form.adminLastName.trim()) {
      toast({ title: "Missing fields", description: "Name, admin first name and last name are required.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name:           form.name,
      adminFirstName: form.adminFirstName,
      adminLastName:  form.adminLastName,
      adminEmail:     form.adminEmail || undefined,
      adminUserId:    form.adminUserId || undefined,
    });
  };

  const field = (key: keyof CreateForm) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Tenants
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All YMSNOW tenant organizations — {tenants.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="h-8 w-8 p-0 text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-8 text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New Tenant
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold w-[260px]">Organization</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Slug</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Plan</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Subscription</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Created</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Loading tenants…
                </TableCell>
              </TableRow>
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  No tenants yet. Create the first one above.
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((t) => {
                const isSuspended = t.subscriptionStatus === "suspended";
                const isPending = patchMutation.isPending && (patchMutation.variables as any)?.id === t.id;

                return (
                  <TableRow key={t.id} className={isSuspended ? "opacity-60" : ""}>
                    <TableCell>
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-px">{t.id.slice(0, 8)}…</p>
                    </TableCell>
                    <TableCell>
                      <code className="text-[12px] bg-muted px-1.5 py-0.5 rounded font-mono">{t.slug}</code>
                    </TableCell>
                    <TableCell>
                      <PlanBadge code={t.planCode} name={t.planName} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.subscriptionStatus} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={isSuspended ? "outline" : "ghost"}
                        className={`h-7 text-xs gap-1 ${isSuspended ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "text-red-600 hover:bg-red-50 hover:text-red-700"}`}
                        disabled={patchMutation.isPending}
                        onClick={() =>
                          patchMutation.mutate({
                            id: t.id,
                            status: isSuspended ? "active" : "suspended",
                          })
                        }
                      >
                        {isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isSuspended ? (
                          <PlayCircle className="h-3 w-3" />
                        ) : (
                          <PauseCircle className="h-3 w-3" />
                        )}
                        {isSuspended ? "Reactivate" : "Suspend"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Tenant</DialogTitle>
            <DialogDescription>
              A Core subscription and an admin user account will be created automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            {/* Tenant name */}
            <div className="space-y-1.5">
              <Label htmlFor="t-name" className="text-xs font-semibold">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="t-name"
                placeholder="Acme Logistics"
                value={form.name}
                onChange={(e) => field("name")(e.target.value)}
                required
                className="h-8 text-sm"
              />
            </div>

            {/* Admin name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-fn" className="text-xs font-semibold">
                  Admin First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="t-fn"
                  placeholder="Jane"
                  value={form.adminFirstName}
                  onChange={(e) => field("adminFirstName")(e.target.value)}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-ln" className="text-xs font-semibold">
                  Admin Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="t-ln"
                  placeholder="Smith"
                  value={form.adminLastName}
                  onChange={(e) => field("adminLastName")(e.target.value)}
                  required
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Admin email */}
            <div className="space-y-1.5">
              <Label htmlFor="t-email" className="text-xs font-semibold">Admin Email</Label>
              <Input
                id="t-email"
                type="email"
                placeholder="jane@acme.com"
                value={form.adminEmail}
                onChange={(e) => field("adminEmail")(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Admin user ID (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="t-uid" className="text-xs font-semibold">
                Admin User ID{" "}
                <span className="text-muted-foreground font-normal">(auto-generated if blank)</span>
              </Label>
              <Input
                id="t-uid"
                placeholder="acme-admin"
                value={form.adminUserId}
                onChange={(e) => field("adminUserId")(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating…</>
                ) : (
                  <>Create Tenant</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
