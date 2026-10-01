import type { ChatListItem } from './chat-items';

export type ChatRow =
  ChatListItem | { readonly kind: 'history'; readonly key: 'history' };

const HISTORY_ROW: ChatRow = { kind: 'history', key: 'history' };

const ESTIMATED_HEIGHT: Readonly<Record<ChatRow['kind'], number>> = {
  history: 40,
  day: 36,
  unread: 36,
  message: 56,
  pending: 64,
};

const FIRST_OF_RUN_EXTRA = 20;

/** The log's rows: a row for the history before them while there is more of it, then the chat's. */
export const chatRows = (
  items: readonly ChatListItem[],
  hasOlder: boolean,
): readonly ChatRow[] => (hasOlder ? [HISTORY_ROW, ...items] : items);

/** A row's height before it is measured, close enough that the log does not jump when it is. */
export const estimatedRowHeight = (row: ChatRow | undefined): number => {
  if (!row) return ESTIMATED_HEIGHT.message;
  const base = ESTIMATED_HEIGHT[row.kind];
  return row.kind === 'message' && row.isFirstOfRun
    ? base + FIRST_OF_RUN_EXTRA
    : base;
};

/**
 * Where the log opens: at the unread divider, with what came before it above the fold, or at the
 * newest message when there is nothing unread.
 */
export const openingRow = (
  rows: readonly ChatRow[],
): { readonly index: number; readonly align: 'start' | 'end' } => {
  const unread = rows.findIndex((row) => row.kind === 'unread');
  return unread >= 0
    ? { index: unread, align: 'start' }
    : { index: rows.length - 1, align: 'end' };
};

/** How far down the log `row` starts before anything is measured, which the log first opens at. */
export const estimatedOffsetOf = (
  rows: readonly ChatRow[],
  index: number,
): number =>
  rows
    .slice(0, Math.max(index, 0))
    .reduce((total, row) => total + estimatedRowHeight(row), 0);

/** Whether the reader asked for less motion, so the log jumps to a new message rather than glides. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
