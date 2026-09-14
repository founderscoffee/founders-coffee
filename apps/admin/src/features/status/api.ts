import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';

import {
  createAuth,
  getSession,
  roleAllows,
  type AuthEnv,
} from '@founders-coffee/auth';

export interface OperatorStatus {
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly permissions: readonly string[];
}

const OPERATIONS_ACTIONS = [
  ['operations', 'read'],
  ['metrics', 'read'],
  ['moderation', 'event'],
  ['moderation', 'user'],
  ['closeout', 'override'],
  ['host_trust', 'update'],
  ['audit', 'read'],
] as const;

/**
 * What this operator is and what they may do, answered from the session and the permission table.
 *
 * The permissions are derived rather than stored: asking `roleAllows` the same question the server
 * will ask when the action is attempted means this screen cannot drift from what the product
 * actually permits. A hand-written list beside a role name is a second source of truth, and the one
 * people read is never the one that decides.
 *
 * The Worker has already refused anyone without a correlated Access identity and an operator role,
 * so reaching this function means the request is authorised; the session read is for identity, not
 * for permission.
 */
export const getOperatorStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<OperatorStatus> => {
    const { auth } = createAuth(env as unknown as AuthEnv);
    const session = await getSession(auth, new Headers(getRequestHeaders()));
    const user = session?.user as
      { email?: string; name?: string; role?: string } | undefined;
    const role = user?.role ?? '';
    return {
      email: user?.email ?? '',
      name: user?.name ?? '',
      role,
      permissions: OPERATIONS_ACTIONS.filter(([resource, action]) =>
        roleAllows(role, { [resource]: [action] }),
      ).map(([resource, action]) => `${resource}:${action}`),
    };
  },
);
