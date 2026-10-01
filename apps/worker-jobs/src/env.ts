import type { AppQueueMessage } from '@founders-coffee/core';

export interface Env {
  readonly DB: D1Database;
  readonly NOTIFICATIONS?: Queue<AppQueueMessage>;
  readonly NOTIFICATION_SCHEDULE?: DurableObjectNamespace;
  readonly EMAIL: SendEmail;
  readonly MAIL_FROM: string;
  readonly APP_URL?: string;
  readonly AI: Ai;
  readonly VECTOR: VectorizeIndex;
  readonly PROFILE_ASSETS?: R2Bucket;
  readonly TWILIO_AID?: string;
  readonly TWILIO_SEC?: string;
  readonly TWILIO_SMS_FROM?: string;
  readonly FIREBASE_PROJECT_ID?: string;
  readonly FIREBASE_SERVICE_ACCOUNT?: string;
}
