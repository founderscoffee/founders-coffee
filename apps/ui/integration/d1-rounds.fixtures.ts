import { env } from 'cloudflare:workers';

export interface D1Call {
  readonly sql: string;
  readonly round: number;
}

const DELAY_MS = 15;
const EXECUTES = new Set(['first', 'all', 'run', 'raw']);

/**
 * Wrap the D1 binding the Worker reads, recording the round each call to D1 starts in.
 *
 * Every call waits a fixed delay before it runs. A call's round is one more than the latest round
 * any finished call belonged to, so calls that start together share one, and a call that had to
 * wait for another's answer starts the next. The highest round is then the number of trips to D1
 * a request waits on in a row. That is what a Worker far from its database pays for each, and
 * local D1 answers from disk, so wall time alone cannot show it. `restore` puts the binding back.
 */
export const recordD1Rounds = () => {
  const binding = env.DB;
  const calls: D1Call[] = [];
  const unwrapped = new WeakMap<object, D1PreparedStatement>();
  let finished = 0;

  const timed = async <T>(sql: string, run: () => Promise<T>): Promise<T> => {
    const round = finished + 1;
    calls.push({ sql, round });
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    try {
      return await run();
    } finally {
      finished = Math.max(finished, round);
    }
  };

  const statement = (
    real: D1PreparedStatement,
    sql: string,
  ): D1PreparedStatement => {
    const wrapped = new Proxy(real, {
      get: (target, property, receiver) => {
        if (property === 'bind')
          return (...values: unknown[]) =>
            statement(target.bind(...values), sql);
        if (typeof property === 'string' && EXECUTES.has(property))
          return (...args: unknown[]) =>
            timed(sql, () =>
              Reflect.apply(
                Reflect.get(target, property, receiver) as (
                  ...values: unknown[]
                ) => Promise<unknown>,
                target,
                args,
              ),
            );
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    unwrapped.set(wrapped, real);
    return wrapped;
  };

  const database = new Proxy(binding, {
    get: (target, property) => {
      if (property === 'prepare')
        return (sql: string) => statement(target.prepare(sql), sql);
      if (property === 'batch')
        return (statements: D1PreparedStatement[]) =>
          timed(`batch of ${statements.length}`, () =>
            target.batch(statements.map((each) => unwrapped.get(each) ?? each)),
          );
      if (property === 'exec')
        return (sql: string) => timed(sql, () => target.exec(sql));
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  Object.defineProperty(env, 'DB', {
    value: database,
    configurable: true,
    writable: true,
  });

  return {
    calls,
    rounds: () => Math.max(0, ...calls.map((call) => call.round)),
    timeline: () =>
      calls
        .map((call) => `${call.round}: ${call.sql.slice(0, 140)}`)
        .join('\n'),
    restore: () =>
      Object.defineProperty(env, 'DB', {
        value: binding,
        configurable: true,
        writable: true,
      }),
  };
};
