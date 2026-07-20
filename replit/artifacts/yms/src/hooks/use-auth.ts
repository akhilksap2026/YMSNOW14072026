import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/**
 * Returns the currently authenticated user from the server-side session.
 * Calls GET /api/auth/me; returns null (not 401) when unauthenticated.
 */
export function useAuth() {
  const { data: user = null, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: Infinity,
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
