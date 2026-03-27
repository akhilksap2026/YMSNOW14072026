import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/enterprise";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Users,
  Star,
  ShieldAlert,
  Shield,
  ShieldOff,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Role {
  id: number;
  roleName: string;
  roleDescription: string | null;
  roleLevel: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string | null;
  userCount: number;
}

function levelLabel(level: number): string {
  if (level >= 100) return "Super Admin";
  if (level >= 80) return "Supervisor";
  if (level >= 60) return "Operator";
  if (level >= 50) return "Crew";
  if (level >= 20) return "External";
  return "Viewer";
}

function levelBadgeClass(level: number): string {
  if (level >= 100) return "bg-red-100 text-red-700 border-red-200";
  if (level >= 80) return "bg-orange-100 text-orange-700 border-orange-200";
  if (level >= 60) return "bg-blue-100 text-blue-700 border-blue-200";
  if (level >= 50) return "bg-green-100 text-green-700 border-green-200";
  if (level >= 20) return "bg-purple-100 text-purple-700 border-purple-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function LevelIcon({ level }: { level: number }) {
  const cls = "h-4 w-4";
  if (level >= 100) return <ShieldAlert className={cls} />;
  if (level >= 80) return <ShieldCheck className={cls} />;
  if (level >= 50) return <Shield className={cls} />;
  return <ShieldOff className={cls} />;
}

function apiRequest(method: string, url: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ message: r.statusText }));
      throw new Error(err.message ?? "Request failed");
    }
    return r.json();
  });
}

interface FormState {
  roleName: string;
  roleDescription: string;
  roleLevel: number;
  isActive: boolean;
}

const INITIAL_FORM: FormState = { roleName: "", roleDescription: "", roleLevel: 50, isActive: true };

export default function RoleMasterPage({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const { data: roleList = [], isLoading } = useQuery<Role[]>({
    queryKey: ["/api/admin/rbac/roles"],
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => apiRequest("POST", "/api/admin/rbac/roles", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/rbac/roles"] });
      toast({ title: "Role created", description: `"${form.roleName}" is now available.` });
      setDialogOpen(false);
      setForm(INITIAL_FORM);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) =>
      apiRequest("PATCH", `/api/admin/rbac/roles/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/rbac/roles"] });
      toast({ title: "Role updated", description: `"${form.roleName}" updated successfully.` });
      setDialogOpen(false);
      setEditingRole(null);
      setForm(INITIAL_FORM);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive, roleName }: { id: number; isActive: boolean; roleName: string }) =>
      apiRequest("PATCH", `/api/admin/rbac/roles/${id}`, { isActive }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/rbac/roles"] });
      toast({ title: v.isActive ? "Role activated" : "Role deactivated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingRole(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setForm({
      roleName: role.roleName,
      roleDescription: role.roleDescription ?? "",
      roleLevel: role.roleLevel,
      isActive: role.isActive,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.roleName.trim()) return;
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const totalRoles = roleList.length;
  const activeRoles = roleList.filter((r) => r.isActive).length;
  const totalUsers = roleList.reduce((acc, r) => acc + (r.userCount ?? 0), 0);

  return (
    <div className={embedded ? "space-y-4" : "flex flex-col h-full min-h-0"}>
      {!embedded && (
        <PageHeader
          title="Role Master"
          subtitle="Manage system roles and their access levels"
          icon={<ShieldCheck className="h-5 w-5" />}
          actions={
            <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Create Role
            </Button>
          }
        />
      )}

      <div className={embedded ? "space-y-4" : "flex-1 overflow-auto p-6"}>
        {/* Embedded header row */}
        {embedded && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Manage system roles and their access levels</p>
            <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Create Role
            </Button>
          </div>
        )}
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Roles", value: totalRoles, icon: Shield, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Active Roles", value: activeRoles, icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50" },
            { label: "Users Assigned", value: totalUsers, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white border rounded-lg p-4 flex items-center gap-3">
              <div className={`${bg} ${color} p-2.5 rounded-lg`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Roles Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Role</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Level</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Users</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : roleList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    No roles defined. Click "Create Role" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                [...roleList]
                  .sort((a, b) => b.roleLevel - a.roleLevel)
                  .map((role) => (
                    <TableRow key={role.id} className={!role.isActive ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${levelBadgeClass(role.roleLevel)}`}>
                            <LevelIcon level={role.roleLevel} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{role.roleName}</p>
                            {role.roleDescription && (
                              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                                {role.roleDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${levelBadgeClass(role.roleLevel)}`}>
                            L{role.roleLevel}
                          </span>
                          <span className="text-xs text-muted-foreground">{levelLabel(role.roleLevel)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{role.userCount ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {role.isSystem ? (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Lock className="h-2.5 w-2.5" />System
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Star className="h-2.5 w-2.5" />Custom
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={role.isActive ? "default" : "secondary"}
                          className={`text-[10px] ${role.isActive ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : ""}`}
                        >
                          {role.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(role)}
                            title="Edit role"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!role.isSystem && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-7 px-2 text-xs ${role.isActive ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}`}
                              onClick={() => toggleMutation.mutate({ id: role.id, isActive: !role.isActive, roleName: role.roleName })}
                            >
                              {role.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Role Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.roleName}
                onChange={(e) => setForm((f) => ({ ...f, roleName: e.target.value }))}
                placeholder="e.g. Dock Supervisor"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.roleDescription}
                onChange={(e) => setForm((f) => ({ ...f, roleDescription: e.target.value }))}
                placeholder="Briefly describe this role's responsibilities"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Access Level (1–100)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.roleLevel}
                onChange={(e) => setForm((f) => ({ ...f, roleLevel: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">
                Higher = more authority. Admin = 100, Supervisor = 80, Operator = 60, Crew = 50, External = 20.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.roleName.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
