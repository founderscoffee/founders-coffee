import { reportError } from '@founders-coffee/observability';

import { workerMetrics } from './env.js';

export const CLOSEOUT_INTENT_FAILED_METRIC = 'closeout_intent_failed';
export const SCHEDULE_ARM_FAILED_METRIC = 'notification_schedule_arm_failed';

/**
 * Raise a swallowed failure somewhere a person could be paged from.
 *
 * CO-05 asks for failures to be "logged **and** alerted", and a log line is not an alert: nothing
 * watches it. Analytics Engine is the only alertable channel this deployment has, so the paths that
 * must never throw — a best-effort closeout intent, an unreachable scheduler — count their failures
 * as well as writing them, and an environment where one fails routinely becomes a number that can
 * carry a threshold rather than a string somebody would have to go looking for.
 *
 * Counting must never become the thing that breaks the caller: these call sites exist precisely
 * because nothing downstream of a durable write may throw, so the counter's own failure is reported
 * and swallowed in turn. A missing binding is not a failure at all — `workerMetrics()` returns null
 * where the dataset is unbound, which is every local run.
 *
 * The market is the Analytics Engine index, so a threshold can be set per market rather than only
 * across the whole platform; callers that genuinely have no market pass none and land under
 * `global`.
 */
export const alertFailure = (metric: string, market?: string): void => {
  try {
    workerMetrics()?.trackEvent(metric, market ? { market } : {});
  } catch (error) {
    reportError(error, { operation: metric });
  }
};
