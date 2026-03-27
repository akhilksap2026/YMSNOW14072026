import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/enterprise";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, Save, RotateCcw, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Role {
  id: number;
  roleName: string;
  roleLevel: number;
  isActive: boolean;
  isSystem: boolean;
}

interface Permission {
  id: number;
  moduleName: string;
  actionName: string;
  description: string | null;
}

interface RolePermission {
  id: number;
  roleId: number;
  permissionId: number;
  moduleName: string;
  actionName: string;
  canView: boolean;
  canCreate: boolean;
  canModify: boolean;
  canExecute: boolean;
  canApprove: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  appointments:  "Appointments",
  gate:          "Gate Operations",
  dock:          "Dock Management",
  yard_slot:     "Yard Slots",
  move:          "Yard Moves",
  hold:          "Holds & Exceptions",
  ready_to_go:   "Ready to Go",
  reports:       "Reports & Analytics",
  user_mgmt:     "User Management",
  role_mgmt:     "Role Management",
};

const MODULE_ORDER = [
  "appointments", "gate", "dock", "yard_slot", "move",
  "hold", "ready_to_go", "reports", "user_mgmt", "role_mgmt",
];

const PERM_COLS: { key: keyof RolePermission; label: string; color: string }[] = [
  { key: "canView",    label: "View",    color: "text-blue-600" },
  { key: "canCreate",  label: "Create",  color: "text-green-600" },
  { key: "canModify",  label: "Modify",  color: "text-amber-600" },
  { key: "canExecute", label: "Execute", color: "text-purple-600" },
  { key: "canApprove", label: "Approve", color: "text-red-600" },
];

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

type MatrixState = Record<number, { canView: boolean; canCreate: boolean; canModify: boolean; canExecute: boolean; canApprove: boolean }>;

export default function PermissionMatrixPage({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [draft, setDraft] = useState<MatrixState>({});
  const [isDirty, setIsDirty] = useState(false);

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/admin/rbac/roles"],
  });

  const { data: perms = [], isLoading: permsLoading } = useQuery<Permission[]>({
    queryKey: ["/api/admin/rbac/permissions"],
  });

  const { data: matrix = [], isLoading: matrixLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/admin/rbac/role-permissions", selectedRoleId],
    enabled: selectedRoleId !== null,
    queryFn: async () => {
      if (!selectedRoleId) return [];
      const res = await fetch(`/api/admin/rbac/role-permissions/${selectedRoleId}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (matrix.length > 0) {
      const state: MatrixState = {};
      for (const row of matrix) {
        state[row.permissionId] = {
          canView: row.canView,
          canCreate: row.canCreate,
          canModify: row.canModify,
          canExecute: row.canExecute,
          canApprove: row.canApprove,
        };
      }
      setDraft(state);
      setIsDirty(false);
    }
  }, [matrix]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const entries = perms.map((p) => ({
        permissionId: p.id,
        canView:    draft[p.id]?.canView    ?? false,
        canCreate:  draft[p.id]?.canCreate  ?? false,
        canModify:  draft[p.id]?.canModify  ?? false,
        canExecute: draft[p.id]?.canExecute ?? false,
        canApprove: draft[p.id]?.canApprove ?? false,
      }));
      return apiRequest("PUT", `/api/admin/rbac/role-permissions/${selectedRoleId}`, entries);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/rbac/role-permissions", selectedRoleId] });
      toast({ title: "Permissions saved", description: "The permission matrix has been updated." });
      setIsDirty(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleRoleChange(roleIdStr: string) {
    const id = Number(roleIdStr);
    setSelectedRoleId(id);
    setDraft({});
    setIsDirty(false);
  }

  function toggle(permId: number, col: keyof MatrixState[number]) {
    setDraft((prev) => {
      const current = prev[permId] ?? { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false };
      const updated = { ...current, [col]: !current[col] };
      if (col !== "canView" && updated[col]) {
        updated.canView = true;
      }
      return { ...prev, [permId]: updated };
    });
    setIsDirty(true);
  }

  function handleReset() {
    const state: MatrixState = {};
    for (const row of matrix as RolePermission[]) {
      state[row.permissionId] = {
        canView: row.canView,
        canCreate: row.canCreate,
        canModify: row.canModify,
        canExecute: row.canExecute,
        canApprove: row.canApprove,
      };
    }
    setDraft(state);
    setIsDirty(false);
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const orderedPerms = [...perms].sort(
    (a, b) => MODULE_ORDER.indexOf(a.moduleName) - MODULE_ORDER.indexOf(b.moduleName)
  );

  return (
    <div className={embedded ? "space-y-4" : "flex flex-col h-full min-h-0"}>
      {!embedded && (
        <PageHeader
          title="Permission Matrix"
          subtitle="Configure module-level permissions for each role"
          icon={<KeyRound className="h-5 w-5" />}
          actions={
            selectedRoleId && isDirty ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </Button>
              </div>
            ) : null
          }
        />
      )}

      <div className={embedded ? "space-y-4" : "flex-1 overflow-auto p-6"}>
        {/* Role Selector */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 max-w-sm">
            <Select
              value={selectedRoleId?.toString() ?? ""}
              onValueChange={handleRoleChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a role to configure…" />
              </SelectTrigger>
              <SelectContent>
                {roles.filter((r) => r.isActive).sort((a, b) => b.roleLevel - a.roleLevel).map((r) => (
                  <SelectItem key={r.id} value={r.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{r.roleName}</span>
                      <span className="text-xs text-muted-foreground">(L{r.roleLevel})</span>
                      {r.isSystem && <Badge variant="secondary" className="text-[9px] py-0">System</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedRole && (
            <Badge variant="outline" className="text-xs gap-1">
              <KeyRound className="h-3 w-3" />
              {selectedRole.roleName}
            </Badge>
          )}
          {isDirty && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
              Unsaved changes
            </Badge>
          )}
          {embedded && isDirty && (
            <div className="flex items-center gap-2 ml-auto">
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {!selectedRoleId ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <KeyRound className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">Select a role to view and configure its permissions</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Choose from the dropdown above to load the permission matrix.
            </p>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 px-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                <span>Enabling Create/Modify/Execute/Approve automatically enables View</span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider w-56">Module</TableHead>
                    {PERM_COLS.map((col) => (
                      <TableHead key={col.key} className={`text-xs font-semibold uppercase tracking-wider text-center ${col.color}`}>
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(matrixLoading || permsLoading) ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        {PERM_COLS.map((_, j) => (
                          <TableCell key={j} className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    orderedPerms.map((perm) => {
                      const row = draft[perm.id] ?? {
                        canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false,
                      };
                      const hasAny = Object.values(row).some(Boolean);
                      return (
                        <TableRow key={perm.id} className={hasAny ? "bg-blue-50/30" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {MODULE_LABELS[perm.moduleName] ?? perm.moduleName}
                              </p>
                              {perm.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                                  {perm.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          {PERM_COLS.map((col) => (
                            <TableCell key={col.key} className="text-center">
                              <Checkbox
                                checked={!!(row as any)[col.key]}
                                onCheckedChange={() => toggle(perm.id, col.key as keyof MatrixState[number])}
                                className={`mx-auto ${!!(row as any)[col.key] ? "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" : ""}`}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {isDirty && (
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset Changes
                </Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saveMutation.isPending ? "Saving…" : "Save Permission Matrix"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
