import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { configureZodRuntime } from './zod-runtime.js';

describe('configureZodRuntime', () => {
  it('disables JIT compilation so no schema ever reaches the Function constructor', () => {
    configureZodRuntime();
    expect(z.config().jitless).toBe(true);
  });

  it('leaves validation behaviour untouched', () => {
    configureZodRuntime();
    const schema = z.object({ name: z.string().min(2), age: z.number().int() });
    expect(schema.parse({ name: 'Amine', age: 30 })).toEqual({
      name: 'Amine',
      age: 30,
    });
    expect(schema.safeParse({ name: 'a', age: 1.5 }).success).toBe(false);
  });

  it('is idempotent', () => {
    configureZodRuntime();
    configureZodRuntime();
    expect(z.config().jitless).toBe(true);
  });
});
