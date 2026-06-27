import type { LogLevel } from './levels.js';

/** Where a log originated — lets a single stream distinguish UI from Worker entries. */
export type LogService = 'ui' | 'worker';

/** Per-call or bound context — merged into a LogEntry (sanitized before emit). */
export type LogContext = Record<string, unknown>;

export interface LogEntry {
  /** ISO-8601 timestamp. */
  readonly ts: string;
  readonly level: LogLevel;
  readonly msg: string;
  readonly service: LogService;
  /** Active market code (e.g. `DZ`) — request-scoped via context (AGENTS.md §13). */
  readonly market?: string;
  /** Active locale (`ar`/`en`/`fr`) — request-scoped via context. */
  readonly locale?: string;
  /** Authenticated user id, when known. */
  readonly userId?: string;
  /** Per-request correlation id (set by P0-012 request middleware). */
  readonly requestId?: string;
  /** Arbitrary structured context. */
  readonly [key: string]: unknown;
}

/** Methods shared by server + client loggers — the centralized API (AGENTS.md §13). */
export interface Logger {
  readonly debug: (msg: string, context?: LogContext) => void;
  readonly info: (msg: string, context?: LogContext) => void;
  readonly warn: (msg: string, context?: LogContext) => void;
  readonly error: (msg: string, context?: LogContext) => void;
  readonly fatal: (msg: string, context?: LogContext) => void;
  /** Derive a logger that always merges `context` into every entry (request/market scope). */
  readonly child: (context: LogContext) => Logger;
}
