import { queryClient } from "@/lib/queryClient";

  export function invalidateAll() {
    queryClient.invalidateQueries();
  }
  