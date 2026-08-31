import { QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { authClient } from './auth';
import { queryClient } from './query-client';

type AuthContextValue = {
  user: { id: string; name: string; email: string; role: string } | null;
  session: { id: string; userId: string; expiresAt: Date } | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  permissions: [],
  isAuthenticated: false,
  isLoading: true,
});

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { data, isPending } = authClient.useSession();

  const value = useMemo(() => {
    const session = data?.session ?? null;
    const rawUser = data?.user ?? null;
    const user = rawUser
      ? {
          id: rawUser.id,
          name: rawUser.name,
          email: rawUser.email,
          role: rawUser.role ?? 'member',
        }
      : null;
    const isAuthenticated = !!user && !!session;
    const permissions = user?.role ? [user.role] : [];
    return {
      user,
      session,
      permissions,
      isAuthenticated,
      isLoading: isPending,
    };
  }, [data, isPending]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

export const useAuth = () => useContext(AuthContext);
