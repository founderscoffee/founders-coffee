import { describe, expect, it } from 'vitest';
import { sanitize } from './sanitize.js';

describe('sanitize', () => {
  it('redacts secret-bearing keys', () => {
    expect(sanitize({ password: 'x', token: 'y', normal: 'z' })).toEqual({
      password: '[redacted]',
      token: '[redacted]',
      normal: 'z',
    });
  });

  it('redacts nested secrets', () => {
    expect(sanitize({ user: { handle: 'founder', apiKey: 'k' } })).toEqual({
      user: { handle: 'founder', apiKey: '[redacted]' },
    });
  });

  it('masks a single-character email local part entirely', () => {
    expect(sanitize('a@b.com')).toBe('*@b.com');
  });

  it('masks email-shaped string values', () => {
    expect(sanitize('founder@example.com')).toBe('f******@example.com');
    expect(sanitize('plain text')).toBe('plain text');
  });

  it('passes through primitives and arrays', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(true)).toBe(true);
    expect(sanitize([{ otp: '123' }, 'ok'])).toEqual([{ otp: '[redacted]' }, 'ok']);
  });

  it('handles circular references', () => {
    const node: Record<string, unknown> = { name: 'a' };
    node.self = node;
    const result = sanitize(node) as Record<string, unknown>;
    expect(result.name).toBe('a');
    expect(result.self).toBe('[circular]');
  });

  it('caps depth at the configured maximum', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: 'x' } } } } } } } } };
    expect(JSON.stringify(sanitize(deep))).toContain('[max-depth]');
  });
});
