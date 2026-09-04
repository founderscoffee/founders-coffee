import { describe, expect, it } from 'vitest';

describe('zod-jitless-shim', () => {
  it('builds and runs an object schema without ever reaching the Function constructor', async () => {
    const realFunction = globalThis.Function;
    let constructed = 0;
    globalThis.Function = new Proxy(realFunction, {
      construct: (target, args, newTarget) => {
        constructed += 1;
        return Reflect.construct(target, args, newTarget);
      },
    }) as FunctionConstructor;

    let observed: number | undefined;
    let parsed: unknown;
    let rejected: unknown;
    try {
      const zod = await import('./zod-jitless-shim.js');
      const schema = zod.z.object({
        name: zod.z.string(),
        age: zod.z.number().int(),
      });
      parsed = schema.parse({ name: 'Amine', age: 30 });
      rejected = schema.safeParse({ name: 'Amine', age: 1.5 }).success;
      observed = constructed;
    } finally {
      globalThis.Function = realFunction;
    }

    expect(observed).toBe(0);
    expect(parsed).toEqual({ name: 'Amine', age: 30 });
    expect(rejected).toBe(false);
  });

  it('reports the JIT as unavailable, which is what keeps the probe from running', async () => {
    const zod = await import('./zod-jitless-shim.js');
    expect(zod.config().jitless).toBe(true);
    expect(zod.util.allowsEval.value).toBe(false);
  });

  it('re-exports everything bare zod does, so the alias is transparent to importers', async () => {
    const shim = await import('./zod-jitless-shim.js');
    const bare = await import('zod');
    expect(Object.keys(shim).sort()).toEqual(Object.keys(bare).sort());
  });
});
