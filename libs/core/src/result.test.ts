import { describe, expect, it } from 'vitest';
import { AppError, appErrorCode, err, handleResult, ok } from './result.js';

describe('Result envelope', () => {
  it('ok builds a success result', () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
  });

  it('err builds an error result', () => {
    const e = new AppError('not_found', 'missing');
    expect(err(e)).toEqual({ ok: false, error: e });
  });

  it('AppError carries code + message', () => {
    const e = new AppError('bad_request', 'nope', { field: 'x' });
    expect(e.code).toBe('bad_request');
    expect(e.message).toBe('nope');
    expect(e.details).toEqual({ field: 'x' });
    expect(e).toBeInstanceOf(Error);
  });

  it('handleResult unwraps ok data', async () => {
    await expect(handleResult(Promise.resolve(ok('value')))).resolves.toBe(
      'value',
    );
  });

  it('handleResult throws the error on !ok', async () => {
    const e = new AppError('denied', 'no access');
    await expect(handleResult(Promise.resolve(err(e)))).rejects.toBe(e);
  });
});

describe('appErrorCode', () => {
  it('reads the code from an AppError-shaped object', () => {
    expect(appErrorCode(new AppError('event_full', 'no seats'))).toBe(
      'event_full',
    );
  });

  it('reads the code from a plain object with a string code', () => {
    expect(appErrorCode({ code: 'rate_limited' })).toBe('rate_limited');
  });

  it('returns unknown when the code is missing or non-string', () => {
    expect(appErrorCode(new Error('boom'))).toBe('unknown');
    expect(appErrorCode({ code: 42 })).toBe('unknown');
    expect(appErrorCode(null)).toBe('unknown');
    expect(appErrorCode('string error')).toBe('unknown');
  });
});
