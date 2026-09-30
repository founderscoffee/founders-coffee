const QUERY_PREFIX = 'Failed query: ';
const PARAMS_LABEL = '\nparams: ';
const CAUSE_LABEL = '\ncause: ';
const REDACTED = '[redacted]';
const UNSUPPORTED_VALUE = /(Type '\w+' not supported for value )'[\s\S]*/u;
const ERROR_KIND = /^[A-Z][A-Z0-9_]*(?=:)/u;
const SHORTEST_VALUE = 3;
const MAX_CAUSE_DEPTH = 8;

type QueryError = Error & {
  readonly query: string;
  readonly params: readonly unknown[];
};

const isQueryError = (value: unknown): value is QueryError =>
  value instanceof Error &&
  value.message.startsWith(QUERY_PREFIX) &&
  typeof (value as Partial<QueryError>).query === 'string' &&
  Array.isArray((value as Partial<QueryError>).params);

/**
 * `text` up to the `params:` line of the first failed query in it. Drizzle's message is
 * `Failed query: <sql>\nparams: <values>`; the SQL holds only placeholders, and the values run to the
 * end of the message and may themselves span lines, so everything from the label on goes.
 */
const withoutParams = (text: string): string => {
  const query = text.indexOf(QUERY_PREFIX);
  if (query === -1) return text;
  const params = text.indexOf(PARAMS_LABEL, query + QUERY_PREFIX.length);
  return params === -1 ? text : text.slice(0, params);
};

/**
 * `text` with the bound values of a failed query cut out: the `params:` line of Drizzle's message,
 * and the value D1 quotes when it refuses to bind one (`Type 'bigint' not supported for value …`).
 * Anything else is returned as it came.
 */
export const withoutQueryValues = (text: string): string =>
  withoutParams(text).replace(UNSUPPORTED_VALUE, `$1${REDACTED}`);

/** The bound values worth looking for in a driver's message: text long enough to mean something. */
const valueTexts = (params: readonly unknown[]): string[] =>
  params
    .filter(
      (param) =>
        typeof param === 'string' ||
        typeof param === 'number' ||
        typeof param === 'bigint',
    )
    .map(String)
    .filter((text) => text.length >= SHORTEST_VALUE);

/** Whether `text` quotes any of `params`. */
const quotesAValue = (text: string, params: readonly unknown[]): boolean =>
  valueTexts(params).some((value) => text.includes(value));

/** What is left of a message that quotes a bound value: its error kind (`D1_ERROR`), if it names one. */
const withheld = (text: string): string => {
  const kind = ERROR_KIND.exec(text)?.[0];
  return kind ? `${kind}: ${REDACTED}` : REDACTED;
};

/**
 * Describe `error` with no bound value in it. `params` are the values of every failed query above it
 * in a cause chain, so a driver error that quotes one of them is withheld rather than trusted.
 */
const describe = (
  error: unknown,
  params: readonly unknown[],
  depth: number,
): string => {
  if (isQueryError(error)) {
    const cause =
      error.cause === undefined || depth >= MAX_CAUSE_DEPTH
        ? ''
        : `${CAUSE_LABEL}${describe(error.cause, [...params, ...error.params], depth + 1)}`;
    return `${QUERY_PREFIX}${error.query}${cause}`;
  }
  const text = withoutQueryValues(
    error instanceof Error ? error.message : String(error),
  );
  return quotesAValue(text, params) ? withheld(text) : text;
};

/**
 * The message of a thrown value, with no bound query value in it.
 *
 * A failed Drizzle query is reduced to its SQL, which holds only placeholders, and the message of the
 * D1 error beneath it, which says what went wrong (`UNIQUE constraint failed: user.email`) unless it
 * quotes one of the query's values, in which case only its kind is kept. Any other error keeps its
 * message, less any failed query's values that were copied into it.
 */
export const describeError = (error: unknown): string => describe(error, [], 0);

/**
 * `error`'s stack with its message replaced by `described`. The header V8 writes is the message
 * itself, so it is replaced where it stands and the frames below it are kept; a stack that no longer
 * holds the message is cut as text instead.
 */
const stackWith = (error: Error, described: string): string | undefined => {
  const { stack, message } = error;
  if (typeof stack !== 'string') return undefined;
  const at = stack.indexOf(message);
  return withoutQueryValues(
    at === -1
      ? stack
      : `${stack.slice(0, at)}${described}${stack.slice(at + message.length)}`,
  );
};

/** `error`'s stack, headed by {@link describeError}'s message instead of its own. */
export const describeStack = (error: Error): string | undefined =>
  stackWith(error, describeError(error));

/** Strip `error` and the errors beneath it in place, each against the values of the queries above it. */
const strip = (
  error: unknown,
  params: readonly unknown[],
  depth: number,
): void => {
  if (!(error instanceof Error) || depth > MAX_CAUSE_DEPTH) return;
  const message = describe(error, params, depth);
  const stack = stackWith(error, message);
  if (isQueryError(error)) {
    strip(error.cause, [...params, ...error.params], depth + 1);
    Reflect.set(error, 'params', []);
  } else strip(error.cause, params, depth + 1);
  Reflect.set(error, 'message', message);
  if (stack !== undefined) Reflect.set(error, 'stack', stack);
};

/**
 * Remove every bound query value from a thrown error in place, and return it.
 *
 * For an error on its way out of our code: to TanStack Start, which sends its message to the
 * browser, or to the Workers runtime, which logs whatever a handler throws. Its class, its code and
 * its SQL stay; its message and stack become {@link describeError}'s and {@link describeStack}'s, the
 * same is done to every error in its cause chain, and a failed query's `params` are emptied.
 */
export const stripQueryValues = <T>(error: T): T => {
  strip(error, [], 0);
  return error;
};

/**
 * Throw `error` again once {@link stripQueryValues} has been through it: a Worker or Durable Object
 * handler's last line, so that whatever the runtime logs of an error it lets escape holds no values.
 */
export const rethrowWithoutQueryValues = (error: unknown): never => {
  throw stripQueryValues(error);
};

/**
 * `handler`, with {@link stripQueryValues} run over whatever it throws. For a Worker's `fetch`,
 * `scheduled` or `queue` handler: the runtime logs the message and stack of an error that escapes
 * one, and nothing of ours sees it on the way out.
 */
export const strippingQueryValues =
  <Args extends unknown[], Result>(
    handler: (...args: Args) => Promise<Result>,
  ) =>
  (...args: Args): Promise<Result> =>
    handler(...args).catch(rethrowWithoutQueryValues);
