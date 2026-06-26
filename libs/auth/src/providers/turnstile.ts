/**
 * Turnstile verifier interface (AGENTS.md §11.3/§11.7). Turnstile protects the
 * OTP-send / sign-in endpoints from brute force at the edge. Verification is an
 * outbound HTTP call to Cloudflare's siteverify — an *external service*, so it
 * is mockable in tests (unlike a Cloudflare binding).
 */

export interface TurnstileVerifier {
  verify(token: string | null, remoteIp?: string): Promise<boolean>;
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Production verifier: calls Cloudflare Turnstile siteverify. */
export class TurnstileSiteVerifier implements TurnstileVerifier {
  constructor(private readonly secretKey: string) {}

  async verify(token: string | null, remoteIp?: string): Promise<boolean> {
    if (!token) return false;
    const body = new URLSearchParams({ secret: this.secretKey, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    try {
      const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
      const data = (await res.json()) as { success: boolean };
      return data.success === true;
    } catch {
      // Fail closed — a network error must not let a request through.
      return false;
    }
  }
}

/** Dev verifier: always passes. Used when `TURNSTILE_DISABLED=true` (local dev). */
export class DevTurnstileVerifier implements TurnstileVerifier {
  async verify(): Promise<boolean> {
    return true;
  }
}
