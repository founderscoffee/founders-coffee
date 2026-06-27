/**
 * React Email templates — isolated behind the `@founders-coffee/email/templates` subpath so the
 * main `@founders-coffee/email` barrel (provider + render + types) stays free of JSX/React. Non-React
 * consumers (e.g. apps/worker-jobs) import the provider without pulling React into their bundle;
 * renderers (apps that call `renderEmail`) import templates from this subpath.
 */
export { EmailBase } from './base.js';
export { NotificationEmail } from './notification.js';
export type { EmailBaseProps } from './base.js';
export type { NotificationEmailProps } from './notification.js';
