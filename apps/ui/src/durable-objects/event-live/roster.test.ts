import { describe, expect, it } from 'vitest';

import { EventRoster } from './roster';

const storage = () => {
  const values = new Map<string, unknown>();
  return {
    get: async (key: string) => values.get(key),
    put: async (key: string, value: unknown) => {
      values.set(key, value);
    },
  } as unknown as DurableObjectState['storage'];
};

const roomWithHost = async () => {
  const roster = new EventRoster(storage());
  await roster.ensureRehydrated();
  await roster.admitAttendee('usr_host', 'Amina Benali');
  await roster.admitAttendee('usr_guest', 'Yacine Mokrani');
  await roster.claimHost('usr_host');
  return roster;
};

const statusOf = (roster: EventRoster, userId: string) =>
  roster.toRoster().find((user) => user.userId === userId)?.status;

describe('when the host says they are at the venue', () => {
  it('moves them in the roster too, not only in the host record', async () => {
    const roster = await roomWithHost();
    expect(statusOf(roster, 'usr_host')).toBe('connected');

    await roster.markHostArrived({ tableNumber: 4 });

    expect(
      statusOf(roster, 'usr_host'),
      'the host is an attendee like anyone else, and their row should say where they are',
    ).toBe('arrived');
    expect(roster.getHost()?.arrived).toBe(true);
  });

  it('counts them among the people in the room', async () => {
    const roster = await roomWithHost();

    await roster.markHostArrived({});

    const arrived = roster
      .toRoster()
      .filter((user) => user.status === 'arrived');
    expect(
      arrived.map((user) => user.userId),
      'the arrived count is drawn from the roster, so a host missing from it undercounts the room',
    ).toEqual(['usr_host']);
  });

  it('leaves everyone else where they were', async () => {
    const roster = await roomWithHost();

    await roster.markHostArrived({});

    expect(statusOf(roster, 'usr_guest')).toBe('connected');
  });

  it('does nothing at all in a room that has no host yet', async () => {
    const roster = new EventRoster(storage());
    await roster.ensureRehydrated();
    await roster.admitAttendee('usr_guest', 'Yacine Mokrani');

    expect(await roster.markHostArrived({})).toBe(false);
    expect(statusOf(roster, 'usr_guest')).toBe('connected');
  });
});
