import type { AttendeeStatus, HostState, RosterUser } from './protocol.js';

interface AttendeeState {
  userId: string;
  name: string;
  status: AttendeeStatus;
  etaMinutes?: number;
}

const STORAGE_HOST = 'host';
const STORAGE_ATTENDEES = 'attendees';

export class EventRoster {
  private storage: DurableObjectState['storage'];
  private attendees = new Map<string, AttendeeState>();
  private host: HostState | null = null;
  private rehydrated = false;

  constructor(storage: DurableObjectState['storage']) {
    this.storage = storage;
  }

  ensureRehydrated = async (): Promise<void> => {
    if (this.rehydrated) return;
    this.rehydrated = true;
    const [host, attendees] = await Promise.all([
      this.storage.get<HostState>(STORAGE_HOST),
      this.storage.get<[string, AttendeeState][]>(STORAGE_ATTENDEES),
    ]);
    this.host = host ?? null;
    this.attendees = new Map(attendees ?? []);
  };

  private persist = async (): Promise<void> => {
    await Promise.all([
      this.storage.put(STORAGE_HOST, this.host),
      this.storage.put(STORAGE_ATTENDEES, [...this.attendees.entries()]),
    ]);
  };

  getHost = (): HostState | null => this.host;

  /** Records the first verified host of this event. No-op once a host is known. */
  claimHost = async (userId: string): Promise<void> => {
    if (this.host) return;
    this.host = { userId, arrived: false };
    await this.persist();
  };

  /** Adds a verified attendee on first connection. No-op if already present. */
  admitAttendee = async (userId: string, name: string): Promise<void> => {
    if (this.attendees.has(userId)) return;
    this.attendees.set(userId, { userId, name, status: 'connected' });
    await this.persist();
  };

  markHostArrived = async (details: {
    tableNumber?: number;
    visualCue?: string;
  }): Promise<boolean> => {
    if (!this.host) return false;
    this.host = {
      ...this.host,
      arrived: true,
      tableNumber: details.tableNumber ?? this.host.tableNumber,
      visualCue: details.visualCue ?? this.host.visualCue,
    };
    await this.persist();
    return true;
  };

  pinTable = async (tableNumber: number): Promise<boolean> => {
    if (!this.host) return false;
    this.host.tableNumber = tableNumber;
    await this.persist();
    return true;
  };

  setAttendeeStatus = async (
    userId: string,
    status: AttendeeStatus,
    etaMinutes?: number,
  ): Promise<boolean> => {
    const attendee = this.attendees.get(userId);
    if (!attendee) return false;
    attendee.status = status;
    if (status === 'running_late') attendee.etaMinutes = etaMinutes;
    await this.persist();
    return true;
  };

  toRoster = (): RosterUser[] =>
    [...this.attendees.values()].map((attendee) => ({
      userId: attendee.userId,
      name: attendee.name,
      status: attendee.status,
      etaMinutes: attendee.etaMinutes,
    }));
}
