import { logger } from '@founders-coffee/observability';

export const logServiceWorkerFailure = (error: unknown) => {
  logger.warn('push.service_worker_registration_failed', {
    message: error instanceof Error ? error.message : String(error),
  });
};
