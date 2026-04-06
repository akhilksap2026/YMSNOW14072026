import { useQuery } from "@tanstack/react-query";

  export interface MockUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  }

  const DEMO_USER: MockUser = {
    id: "demo-user",
    email: "demo@yardnow.com",
    firstName: "Demo",
    lastName: "User",
  };

  export function useAuth() {
    return {
      user: DEMO_USER,
      isLoading: false,
      isAuthenticated: true,
      logout: () => {},
      isLoggingOut: false,
    };
  }
  