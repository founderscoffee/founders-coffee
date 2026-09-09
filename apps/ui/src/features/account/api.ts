import { getMyAccount } from '@founders-coffee/server-fns';
import type { AccountSummary } from '@founders-coffee/server-fns';

export const accountApi = {
  getMyAccount: (): Promise<AccountSummary> => getMyAccount({ data: {} }),
};

export type { AccountSummary };
