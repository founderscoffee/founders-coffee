import { AppError, type Result, ok, err } from '@founders-coffee/core';

export interface SendPushArgs {
  readonly token: string;
  readonly title: string;
  readonly body: string;
  readonly url?: string;
  readonly icon?: string;
  readonly dedupeKey?: string;
}

export interface SendPushResult {
  readonly messageId: string;
}

export interface PushProvider {
  readonly name: string;
  send(args: SendPushArgs): Promise<Result<SendPushResult>>;
}

interface FirebaseServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

/**
 * Build a signed JWT for FCM HTTP v1 API access.
 *
 * Uses Workers Web Crypto APIs (available in CF Workers via nodejs_compat).
 * The JWT is signed with RS256 using the Firebase service account's private key.
 *
 * Token lifetime: 60 minutes (FCM rejects tokens older than 60 min).
 * We regenerate on each send for simplicity. If volume grows, cache the
 * token for ~55 minutes.
 */
const buildFcmJwt = async (
  serviceAccount: FirebaseServiceAccount,
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
  };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKeyPem = serviceAccount.private_key;
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${encodedSignature}`;
};

/** Convert a PEM-encoded private key to binary for Web Crypto import. */
const pemToBinary = (pem: string): ArrayBuffer => {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

/**
 * Web Push topics are restricted to URL-safe base64 characters and 32 bytes (RFC 8030 §5.4), which
 * an opaque id prefix can exceed. Anything outside the set is dropped rather than substituted, so
 * two different keys cannot collapse onto one topic.
 */
export const toPushTopic = (key: string): string =>
  key.replace(/[^A-Za-z0-9\-_]/g, '').slice(-32);

export class FcmPushProvider implements PushProvider {
  readonly name = 'fcm';
  private readonly projectId: string;
  private readonly serviceAccount: FirebaseServiceAccount;

  constructor(opts: { projectId: string; serviceAccountJson: string }) {
    this.projectId = opts.projectId;
    this.serviceAccount = JSON.parse(
      opts.serviceAccountJson,
    ) as FirebaseServiceAccount;
  }

  send = async (args: SendPushArgs): Promise<Result<SendPushResult>> => {
    const jwt = await buildFcmJwt(this.serviceAccount);
    const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;

    const message = {
      token: args.token,
      webpush: {
        ...(args.dedupeKey
          ? { headers: { Topic: toPushTopic(args.dedupeKey) } }
          : {}),
        notification: {
          title: args.title,
          body: args.body,
          icon: args.icon ?? '/icons/icon-192.png',
          data: { url: args.url ?? '/', dedupeKey: args.dedupeKey ?? null },
        },
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const data = (await res.json()) as {
          error?: {
            code: number;
            message: string;
            status: string;
            details?: Array<{ errorCode?: string }>;
          };
        };

        const fcmError = data.error;
        const errorCode = fcmError?.details?.[0]?.errorCode;
        const isPermanent =
          errorCode === 'UNREGISTERED' ||
          errorCode === 'INVALID_ARGUMENT' ||
          errorCode === 'SenderIdMismatch';

        return err(
          new AppError(
            isPermanent ? 'push_permanent_failure' : 'push_transient_failure',
            `FCM error ${fcmError?.code ?? res.status}: ${fcmError?.message ?? 'unknown'}`,
          ),
        );
      }

      const data = (await res.json()) as {
        name: string;
      };

      return ok({ messageId: data.name });
    } catch (error) {
      return err(
        new AppError(
          'push_transient_failure',
          `FCM network error: ${error instanceof Error ? error.message : 'unknown'}`,
        ),
      );
    }
  };
}

export class DevPushProvider implements PushProvider {
  readonly name = 'dev-push';
  readonly sent: SendPushArgs[] = [];

  send = async (args: SendPushArgs): Promise<Result<SendPushResult>> => {
    this.sent.push(args);
    console.log(
      `[DevPushProvider] Push to ${args.token.slice(0, 20)}...: ${args.title} — ${args.body}`,
    );
    return ok({ messageId: `dev_push_${Date.now()}` });
  };
}
