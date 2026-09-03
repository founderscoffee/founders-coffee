export interface WorkerEnv {
  readonly DB: D1Database;

  readonly RATE_LIMITER?: DurableObjectNamespace;
  readonly EVENT_LIVE?: DurableObjectNamespace;
  readonly EMAIL?: unknown;
  readonly ANALYTICS?: AnalyticsEngineDataset;

  readonly APP_URL?: string;
  readonly APP_ENVIRONMENT?: string;
  readonly MAIL_FROM?: string;

  readonly MAPBOX_TOKEN?: string;

  readonly TURNSTILE_SECRET_KEY?: string;
  readonly TURNSTILE_SITE_KEY?: string;
  readonly TURNSTILE_DISABLED?: string;
  readonly EVENT_CREATE_WAF_CONFIGURED?: string;

  readonly FIREBASE_API_KEY?: string;
  readonly FIREBASE_PROJECT_ID?: string;
  readonly FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly FIREBASE_APP_ID?: string;
  readonly FIREBASE_VAPID_KEY?: string;

  readonly CSP_ENFORCED?: string;
  readonly OTP_ECHO?: string;
  readonly DEV_GEO?: string;
}

export const DURABLE_OBJECT_LOCATION_HINT = 'weur' as const;
