import { useState, useMemo } from "react";
import { SearchAutocomplete } from "@/components/enterprise/search-autocomplete";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, StatusChip, EmptyState } from "@/components/enterprise";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { roleColor, activeStatusColor } from "@/lib/status-colors";
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
import { useToast } from "@/hooks/use-toast";
import { Users, User as UserIcon, ArrowUpDown, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserWithProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  isActive: boolean;
}

function formatRole(r: string): string {
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRoleBadgeClasses(role: string): string {
  return roleColor(role);
}

function getActiveBadgeClasses(active: boolean): string {
  return activeStatusColor(active);
}

type SortField = "name" | "role";
type SortDir = "asc" | "desc";

export default function AdminUsersPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: users = [], isLoading } = useQuery<UserWithProfile[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${data.userId}/role`, {
        role: data.role,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      const name = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      if (name) set.add(name);
      if (u.email) set.add(u.email);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          (u.firstName || "").toLowerCase().includes(q) ||
          (u.lastName || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q)
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    if (activeFilter !== "all") {
      const isActive = activeFilter === "active";
      result = result.filter((u) => u.isActive === isActive);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        const nameA = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
        const nameB = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
        cmp = nameA.localeCompare(nameB);
      } else if (sortField === "role") {
        cmp = a.role.localeCompare(b.role);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [users, search, roleFilter, activeFilter, sortField, sortDir]);

  return (
    <div className="flex flex-col h-full space-y-4">
      <PageHeader
        title="User Management"
        subtitle="Manage user roles and system access"
        icon={<Users className="h-5 w-5" />}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <SearchAutocomplete
          value={search}
          onChange={setSearch}
          suggestions={suggestions}
          placeholder="Search users..."
          className="w-[220px]"
          data-testid="input-search-users"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-role">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="yard_manager">Yard Manager</SelectItem>
            <SelectItem value="gate_guard">Gate Guard</SelectItem>
            <SelectItem value="yard_jockey">Yard Jockey</SelectItem>
            <SelectItem value="dock_user">Dock User</SelectItem>
            <SelectItem value="carrier">Carrier</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-active">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<UserIcon className="h-5 w-5" />}
          heading={users.length === 0 ? "No users yet" : "No users found"}
          description={
            users.length === 0
              ? "Users will appear here after they sign in for the first time. Invite team members to get started."
              : "No users match your current filters. Try adjusting the role or search term."
          }
          data-testid="text-no-users"
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Avatar</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("name")}
                  data-testid="sort-name"
                >
                  <div className="flex items-center gap-1">
                    Name
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("role")}
                  data-testid="sort-role"
                >
                  <div className="flex items-center gap-1">
                    Role
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.profileImageUrl || ""} />
                      <AvatarFallback className="text-xs">
                        {(u.firstName?.[0] || "") + (u.lastName?.[0] || "")}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-name-${u.id}`}>
                    {u.firstName} {u.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`text-email-${u.id}`}>
                    {u.email}
                  </TableCell>
                  <TableCell data-testid={`text-role-${u.id}`}>
                    <StatusChip 
                      status={u.role} 
                      colorFn={roleColor} 
                      label={formatRole(u.role)}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell data-testid={`text-active-${u.id}`}>
                    <StatusChip 
                      status={u.isActive ? "active" : "inactive"} 
                      colorFn={() => activeStatusColor(u.isActive)} 
                      label={u.isActive ? "Active" : "Inactive"}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(role) =>
                        updateRoleMutation.mutate({ userId: u.id, role })
                      }
                    >
                      <SelectTrigger className="w-[150px]" data-testid={`select-role-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="yard_manager">Yard Manager</SelectItem>
                        <SelectItem value="gate_guard">Gate Guard</SelectItem>
                        <SelectItem value="yard_jockey">Yard Jockey</SelectItem>
                        <SelectItem value="dock_user">Dock User</SelectItem>
                        <SelectItem value="carrier">Carrier</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
