import { describe, expect, it } from 'vitest';

import type { ChatListItem } from './chat-items';
import {
  chatRows,
  estimatedOffsetOf,
  estimatedRowHeight,
  openingRow,
} from './chat-rows';

const day: ChatListItem = {
  kind: 'day',
  key: 'day:1',
  date: new Date('2026-09-30T10:00:00Z'),
  day: 'today',
};

const unread: ChatListItem = { kind: 'unread', key: 'unread' };

describe('the rows of the chat’s log', () => {
  it('holds a row for the history before the first message only while there is more of it', () => {
    expect(chatRows([day], true).map((row) => row.kind)).toEqual([
      'history',
      'day',
    ]);
    expect(chatRows([day], false).map((row) => row.kind)).toEqual(['day']);
  });

  it('opens at the unread divider, and at the newest row when nothing is unread', () => {
    expect(openingRow(chatRows([day, unread, day], true))).toEqual({
      index: 2,
      align: 'start',
    });
    expect(openingRow(chatRows([day, day], false))).toEqual({
      index: 1,
      align: 'end',
    });
  });

  it('places a row below the estimated height of every row above it', () => {
    const rows = chatRows([day, unread, day], true);

    expect(estimatedOffsetOf(rows, 0)).toBe(0);
    expect(estimatedOffsetOf(rows, 2)).toBe(
      estimatedRowHeight(rows[0]) + estimatedRowHeight(rows[1]),
    );
    expect(estimatedOffsetOf(rows, rows.length)).toBe(
      rows.reduce((total, row) => total + estimatedRowHeight(row), 0),
    );
  });
});
