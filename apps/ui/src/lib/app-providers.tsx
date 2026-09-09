import { QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { authClient } from './auth';
import { createQueryClient } from './query-client';
import { memberChanged, withdrawMemberCaches } from './session-cache';

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

const useMemberCacheIsolation = (
  userId: string | null,
  isPending: boolean,
  client: ReturnType<typeof createQueryClient>,
) => {
  const seen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isPending) return;
    const previous = seen.current;
    seen.current = userId;
    if (!memberChanged(previous, userId)) return;
    void withdrawMemberCaches(
      client,
      typeof caches === 'undefined' ? undefined : caches,
    );
  }, [userId, isPending, client]);
};

const AuthProvider = ({
  children,
  client,
}: {
  children: ReactNode;
  client: ReturnType<typeof createQueryClient>;
}) => {
  const { data, isPending } = authClient.useSession();
  useMemberCacheIsolation(data?.user?.id ?? null, isPending, client);

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

export const AppProviders = ({ children }: { children: ReactNode }) => {
  const [client] = useState(createQueryClient);

  return (
    <QueryClientProvider client={client}>
      <AuthProvider client={client}>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

export const useAuth = () => useContext(AuthContext);
