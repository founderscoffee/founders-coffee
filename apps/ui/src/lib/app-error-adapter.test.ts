import { describe, expect, it } from 'vitest';

import { AppError } from '@founders-coffee/core';
import { appErrorCode } from '@founders-coffee/core';

import { appErrorSerializationAdapter } from './app-error-adapter';

const adapter = appErrorSerializationAdapter;

describe('appErrorSerializationAdapter', () => {
  it('claims an AppError and leaves every other error to the shallow plugin', () => {
    expect(adapter.test(new AppError('event_full', 'Event is full'))).toBe(
      true,
    );
    expect(adapter.test(new Error('plain'))).toBe(false);
    expect(adapter.test(new TypeError('typed'))).toBe(false);
    expect(adapter.test({ code: 'looks_like_one' })).toBe(false);
    expect(adapter.test(null)).toBe(false);
  });

  it('round-trips the code so appErrorCode can still branch on it', () => {
    const original = new AppError('rate_limited', 'Too many requests');
    const revived = adapter.fromSerializable(adapter.toSerializable(original));

    expect(revived).toBeInstanceOf(AppError);
    expect(appErrorCode(revived)).toBe('rate_limited');
    expect(revived.message).toBe('Too many requests');
  });

  it('drops details rather than carrying server-side diagnostics to the client', () => {
    const original = new AppError('validation_failed', 'Invalid input', {
      field: 'title',
      trace: () => undefined,
    });

    const serialized = adapter.toSerializable(original);

    expect(Object.keys(serialized).sort()).toEqual(['code', 'message']);
    expect(adapter.fromSerializable(serialized).details).toBeUndefined();
  });
});
