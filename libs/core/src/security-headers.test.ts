import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  securityHeaders,
  withSecurityHeaders,
} from './security-headers.js';

const directives = (policy: string): Map<string, string[]> =>
  new Map(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name, sources] as const;
      }),
  );

describe('security headers', () => {
  it('sets every header AGENTS.md §10 names', () => {
    const headers = securityHeaders();
    expect(Object.keys(headers).sort()).toEqual(
      [
        'content-security-policy-report-only',
        'permissions-policy',
        'referrer-policy',
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
      ].sort(),
    );
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
  });

  it('reports rather than enforces until asked to enforce', () => {
    expect(securityHeaders()).toHaveProperty(
      'content-security-policy-report-only',
    );
    expect(securityHeaders()).not.toHaveProperty('content-security-policy');
    expect(securityHeaders({ enforceCsp: true })).toHaveProperty(
      'content-security-policy',
    );
    expect(securityHeaders({ enforceCsp: true })).not.toHaveProperty(
      'content-security-policy-report-only',
    );
  });

  it('locks down the directives an injected document would abuse', () => {
    const policy = directives(buildContentSecurityPolicy());
    expect(policy.get('base-uri')).toEqual(["'none'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('form-action')).toEqual(["'self'"]);
    expect(policy.get('default-src')).toEqual(["'self'"]);
  });

  it('never allows inline or eval script', () => {
    const scriptSrc = directives(buildContentSecurityPolicy()).get(
      'script-src',
    );
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('admits exactly the three approved integrations and nothing else', () => {
    const policy = buildContentSecurityPolicy();
    const hosts = [...policy.matchAll(/https:\/\/[^\s;]+/g)].map((m) => m[0]);
    const approved = new Set([
      'https://challenges.cloudflare.com',
      'https://api.mapbox.com',
      'https://events.mapbox.com',
      'https://*.tiles.mapbox.com',
      'https://firebaseinstallations.googleapis.com',
      'https://fcmregistrations.googleapis.com',
    ]);
    for (const host of hosts) expect(approved.has(host)).toBe(true);
  });

  it('adds a report endpoint only when one is given', () => {
    expect(buildContentSecurityPolicy()).not.toContain('report-uri');
    expect(buildContentSecurityPolicy({ reportPath: '/csp-report' })).toContain(
      'report-uri /csp-report',
    );
  });

  it('merges an app-specific source without dropping the shared ones', () => {
    const policy = directives(
      buildContentSecurityPolicy({
        extraSources: { 'connect-src': ['https://example.test'] },
      }),
    );
    expect(policy.get('connect-src')).toContain('https://example.test');
    expect(policy.get('connect-src')).toContain("'self'");
    expect(policy.get('connect-src')).toContain('https://api.mapbox.com');
  });
});

describe('withSecurityHeaders', () => {
  it('preserves the body, status and existing headers', async () => {
    const original = new Response('<!doctype html><p>hi</p>', {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'text/html', 'x-existing': 'kept' },
    });

    const secured = withSecurityHeaders(original);

    expect(secured.status).toBe(201);
    expect(secured.statusText).toBe('Created');
    expect(secured.headers.get('content-type')).toBe('text/html');
    expect(secured.headers.get('x-existing')).toBe('kept');
    expect(await secured.text()).toBe('<!doctype html><p>hi</p>');
  });

  it('applies to a server-function style JSON response too', () => {
    const secured = withSecurityHeaders(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(secured.headers.get('x-content-type-options')).toBe('nosniff');
    expect(
      secured.headers.get('content-security-policy-report-only'),
    ).toContain("default-src 'self'");
  });

  it('applies to an error response, which a browser still renders', () => {
    const secured = withSecurityHeaders(
      new Response('forbidden', { status: 403 }),
    );
    expect(secured.status).toBe(403);
    expect(secured.headers.get('x-frame-options')).toBe('DENY');
  });

  /**
   * A real 101 comes from the live-event Durable Object; the Response constructor refuses to build
   * one, so the guard is exercised through a minimal stand-in rather than skipped.
   */
  it('returns a websocket upgrade by identity instead of rebuilding it', () => {
    const upgrade = { status: 101 } as unknown as Response;
    expect(withSecurityHeaders(upgrade)).toBe(upgrade);
  });
});
