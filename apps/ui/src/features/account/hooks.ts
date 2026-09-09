import { useQuery } from '@tanstack/react-query';

import { authClient } from '../../lib/auth';
import { accountApi } from './api';

export const useMyAccount = () => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  const query = useQuery({
    queryKey: ['account', 'summary', userId],
    queryFn: accountApi.getMyAccount,
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return { ...query, userId, isAuthLoading: auth.isPending };
};
