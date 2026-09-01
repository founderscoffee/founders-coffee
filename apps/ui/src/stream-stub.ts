export class Readable {
  /** Server-only; never invoked in the browser. */
  static fromWeb = (): Readable => {
    throw new Error(
      'Readable.fromWeb is server-only and not available in the browser',
    );
  };

  /** Server-only; never invoked in the browser. */
  static toWeb = (): unknown => {
    throw new Error(
      'Readable.toWeb is server-only and not available in the browser',
    );
  };
}

export class Writable {}
export class Duplex {}
export class Transform {}
export class PassThrough {}
export class Stream {}

/** Server-only; never invoked in the browser. */
export const pipeline = (): void => {
  throw new Error(
    'stream.pipeline is server-only and not available in the browser',
  );
};

/** Server-only; never invoked in the browser. */
export const finished = (): void => {
  throw new Error(
    'stream.finished is server-only and not available in the browser',
  );
};
