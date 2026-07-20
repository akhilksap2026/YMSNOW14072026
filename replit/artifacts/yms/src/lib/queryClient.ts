import { QueryClient, QueryCache, MutationCache, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const ROLE_KEY = "ymsnow_current_role";

export function storeCurrentRole(role: string) {
  localStorage.setItem(ROLE_KEY, role);
}

export function getCurrentRole(): string {
  return localStorage.getItem(ROLE_KEY) || "admin";
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const role = getCurrentRole();
  return {
    ...(extra ?? {}),
    "x-user-role": role,
  };
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = buildHeaders(data ? { "Content-Type": "application/json" } : {});
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: buildHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/** Extract a short, human-readable description from a thrown Error. */
function errorDescription(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  // Strip raw JSON blobs; keep first 120 chars
  return msg.replace(/\{.*\}/, "").trim().slice(0, 120) || "An unexpected error occurred.";
}

/** True when the error is an auth redirect — not user-visible. */
function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("401:");
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      // 401s are handled by the auth flow; everything else surfaces as a toast.
      // In TanStack Query v5, useQuery has no per-query onError, so this is the
      // single global handler — fire for every non-auth query failure.
      if (isAuthError(error)) return;
      // Suppress background refetch noise: only toast when the query has no data
      // (i.e. the failure leaves the UI blank, not just stale).
      if (query.state.data !== undefined) return;
      toast({
        title: "Failed to load data",
        description: errorDescription(error),
        variant: "destructive",
      });
    },
  }),

  mutationCache: new MutationCache({
    onError(error, _variables, _context, mutation) {
      // Skip if the mutation already has its own onError handler — those call
      // toast themselves and we don't want to double-up.
      if (typeof mutation.options.onError === "function") return;
      if (isAuthError(error)) return;
      toast({
        title: "Request failed",
        description: errorDescription(error),
        variant: "destructive",
      });
    },
  }),

  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,            // one retry for transient network hiccups
      networkMode: "online",
    },
    mutations: {
      retry: false,        // never retry mutations — unsafe to duplicate writes
      networkMode: "online",
    },
  },
});
