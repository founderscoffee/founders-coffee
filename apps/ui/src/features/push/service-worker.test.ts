import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  register: vi.fn(),
  constructed: [] as unknown[],
}));

vi.mock('@serwist/window', () => ({
  Serwist: class {
    constructor(...args: unknown[]) {
      state.constructed.push(args);
    }
    register = state.register;
  },
}));
vi.mock('@founders-coffee/observability', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const load = async () => {
  vi.resetModules();
  return import('./service-worker');
};

const registration = { scope: '/' } as ServiceWorkerRegistration;

beforeEach(() => {
  state.register.mockReset().mockResolvedValue(registration);
  state.constructed = [];
  vi.stubGlobal('navigator', { serviceWorker: {} });
  vi.stubEnv('PROD', true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('registerServiceWorker', () => {
  it('registers the app’s own worker at the root scope', async () => {
    const { registerServiceWorker } = await load();

    expect(await registerServiceWorker()).toBe(registration);
    expect(state.constructed[0]).toEqual([
      '/sw.js',
      { scope: '/', type: 'classic' },
    ]);
  });

  it('registers once however many callers ask', async () => {
    const { registerServiceWorker } = await load();

    const [first, second] = await Promise.all([
      registerServiceWorker(),
      registerServiceWorker(),
    ]);

    expect(first).toBe(second);
    expect(state.register).toHaveBeenCalledOnce();
  });

  it('does not register in development, where no worker is built', async () => {
    vi.stubEnv('PROD', false);
    const { registerServiceWorker } = await load();

    expect(await registerServiceWorker()).toBeNull();
    expect(state.register).not.toHaveBeenCalled();
  });

  it('does not register in a browser without service workers', async () => {
    vi.stubGlobal('navigator', {});
    const { registerServiceWorker } = await load();

    expect(await registerServiceWorker()).toBeNull();
    expect(state.register).not.toHaveBeenCalled();
  });

  it('answers null rather than throwing when the browser refuses', async () => {
    state.register.mockRejectedValue(new Error('storage blocked'));
    const { registerServiceWorker } = await load();

    expect(await registerServiceWorker()).toBeNull();
  });

  it('retries after a refusal instead of caching the failure forever', async () => {
    state.register.mockRejectedValueOnce(new Error('transient'));
    const { registerServiceWorker } = await load();

    expect(await registerServiceWorker()).toBeNull();
    expect(await registerServiceWorker()).toBe(registration);
    expect(state.register).toHaveBeenCalledTimes(2);
  });

  it('answers null when the browser registers nothing', async () => {
    state.register.mockResolvedValue(undefined);
    const { registerServiceWorker } = await load();

    expect(await registerServiceWorker()).toBeNull();
  });
});
