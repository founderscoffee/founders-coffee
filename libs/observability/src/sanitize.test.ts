import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { AppError } from '@founders-coffee/core';

import { sanitize } from './sanitize.js';

const failedQuery = (): DrizzleQueryError =>
  new DrizzleQueryError(
    'update "user" set "name" = ? where "email" = ?',
    ['Amina, roaster in Oran', 'amina@example.com'],
    new Error('D1_ERROR: no such table: user: SQLITE_ERROR'),
  );

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

  it('masks phone numbers, keeping the country prefix and the last two digits', () => {
    expect(sanitize({ phoneNumber: '+213555123456' })).toEqual({
      phoneNumber: '+213*******56',
    });
    expect(sanitize(['+966501234567', '+15551234567'])).toEqual([
      '+966*******67',
      '+155******67',
    ]);
  });

  it('leaves numbers that are not phone numbers alone', () => {
    expect(sanitize('213555123456')).toBe('213555123456');
    expect(sanitize('+01:00')).toBe('+01:00');
    expect(sanitize(213555123456)).toBe(213555123456);
  });

  it('passes through primitives and arrays', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(true)).toBe(true);
    expect(sanitize([{ otp: '123' }, 'ok'])).toEqual([
      { otp: '[redacted]' },
      'ok',
    ]);
  });

  it('handles circular references', () => {
    const node: Record<string, unknown> = { name: 'a' };
    node.self = node;
    const result = sanitize(node) as Record<string, unknown>;
    expect(result.name).toBe('a');
    expect(result.self).toBe('[circular]');
  });

  it('cuts the values of a failed query out of any string', () => {
    expect(
      sanitize({ reason: `dispatch_threw: ${failedQuery().message}` }),
    ).toEqual({
      reason:
        'dispatch_threw: Failed query: update "user" set "name" = ? where "email" = ?',
    });
  });

  it('logs an error as its name, code and a message without bound values', () => {
    expect(
      sanitize({ error: failedQuery(), refusal: new AppError('x', 'no') }),
    ).toEqual({
      error: {
        name: 'Error',
        message:
          'Failed query: update "user" set "name" = ? where "email" = ?\ncause: D1_ERROR: no such table: user: SQLITE_ERROR',
      },
      refusal: { name: 'AppError', message: 'no', code: 'x' },
    });
  });

  it('caps depth at the configured maximum', () => {
    const deep = {
      a: { b: { c: { d: { e: { f: { g: { h: { i: 'x' } } } } } } } },
    };
    expect(JSON.stringify(sanitize(deep))).toContain('[max-depth]');
  });
});
