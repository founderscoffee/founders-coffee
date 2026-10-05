import { afterEach, describe, expect, it, vi } from 'vitest';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock('@founders-coffee/observability', () => ({ logger: { warn } }));

const loaderWith = async (library: () => object) => {
  vi.resetModules();
  vi.doMock('mapbox-gl/dist/mapbox-gl-csp.js', library);
  const { loadMapboxCsp } = await import('./mapbox-csp');
  return loadMapboxCsp;
};

const failedDownload = () => {
  throw new TypeError(
    'Failed to fetch dynamically imported module: https://founders.coffee/assets/mapbox-gl-csp-DhIhBfn2.js',
  );
};

afterEach(() => {
  vi.doUnmock('mapbox-gl/dist/mapbox-gl-csp.js');
  warn.mockReset();
});

describe('loadMapboxCsp', () => {
  it("hands the map the library's default export", async () => {
    const library = { Map: class {} };
    const loadMapboxCsp = await loaderWith(() => ({ default: library }));

    await expect(loadMapboxCsp()).resolves.toBe(library);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a failed download as a warning and still hands the failure to the map', async () => {
    const loadMapboxCsp = await loaderWith(failedDownload);

    const failure = await loadMapboxCsp()?.then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(warn).toHaveBeenCalledWith('map.library_load_failed', {
      message: (failure as Error).message,
    });
  });

  it('leaves no rejection unhandled while no map has mounted to take it', async () => {
    const loadMapboxCsp = await loaderWith(failedDownload);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    void loadMapboxCsp();
    await new Promise((settle) => setTimeout(settle, 20));
    process.off('unhandledRejection', unhandled);

    expect(
      unhandled,
      'on 2026-10-04 a hover on /ar/algeria started the download and its failure reached the window unhandled',
    ).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });
});
