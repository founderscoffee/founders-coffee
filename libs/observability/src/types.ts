import type { LogLevel } from './levels.js';

export type LogService = 'ui' | 'worker';

export type LogContext = Record<string, unknown>;

export interface LogEntry {
  readonly ts: string;
  readonly level: LogLevel;
  readonly msg: string;
  readonly service: LogService;
  readonly market?: string;
  readonly locale?: string;
  readonly userId?: string;
  readonly requestId?: string;
  readonly [key: string]: unknown;
}

export interface Logger {
  readonly debug: (msg: string, context?: LogContext) => void;
  readonly info: (msg: string, context?: LogContext) => void;
  readonly warn: (msg: string, context?: LogContext) => void;
  readonly error: (msg: string, context?: LogContext) => void;
  readonly fatal: (msg: string, context?: LogContext) => void;
  readonly child: (context: LogContext) => Logger;
}
