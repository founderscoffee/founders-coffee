import { useQuery } from '@tanstack/react-query';

import { authApi } from './api';

export const usePublicAuthConfig = () =>
  useQuery({
    queryKey: ['auth', 'config'],
    queryFn: () => authApi.getPublicAuthConfig(),
  });
