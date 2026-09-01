export class AsyncLocalStorage<T = unknown> {
  enterWith = (_store: T): void => undefined;

  disable = (): void => undefined;

  exit = (callback: () => void): void => {
    callback();
  };

  run = <TResult>(_store: T, callback: () => TResult): TResult => callback();

  getStore = (): T | undefined => undefined;
}
