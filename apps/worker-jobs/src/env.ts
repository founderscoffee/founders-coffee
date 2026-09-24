import type { NotificationDueMessage } from './jobs/messages.js';

export interface Env {
  readonly DB: D1Database;
  readonly NOTIFICATIONS?: Queue<NotificationDueMessage>;
  readonly NOTIFICATION_SCHEDULE?: DurableObjectNamespace;
  readonly EMAIL: SendEmail;
  readonly MAIL_FROM: string;
  readonly AI: Ai;
  readonly VECTOR: VectorizeIndex;
  readonly PROFILE_ASSETS?: R2Bucket;
  readonly TWILIO_AID?: string;
  readonly TWILIO_SEC?: string;
  readonly TWILIO_SMS_FROM?: string;
  readonly FIREBASE_PROJECT_ID?: string;
  readonly FIREBASE_SERVICE_ACCOUNT?: string;
  readonly TELEGRAM_BOT_TOKEN?: string;
}
