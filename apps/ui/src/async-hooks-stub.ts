export class AsyncLocalStorage<T = unknown> {
  enterWith = (store: T): void => void store;

  disable = (): void => undefined;

  exit = (callback: () => void): void => {
    callback();
  };

  run = <TResult>(_store: T, callback: () => TResult): TResult => callback();

  getStore = (): T | undefined => undefined;
}
