const noop = (): void => undefined;

class TestResizeObserver implements ResizeObserver {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}

globalThis.ResizeObserver ??= TestResizeObserver;
