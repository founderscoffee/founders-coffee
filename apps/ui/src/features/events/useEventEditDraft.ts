import { useEffect, useState } from 'react';

import type { EventEditDraft } from './event-edit-draft';
import {
  clearEventEditDraft,
  readEventEditDraft,
  writeEventEditDraft,
} from './event-edit-storage';

/**
 * The host's unsaved changes to a meetup, kept for the tab so that a reload does not take them.
 *
 * `draft` stays null until the host changes something, and the form shows the meetup itself until
 * then. The kept copy is read once the meetup is known and the page is in the browser, since
 * session storage does not exist where the page is rendered on the server. `clear` is for a save
 * that went through: the meetup then shows what was saved, and nothing is left to keep.
 */
export const useEventEditDraft = (
  eventId: string | undefined,
  eventVersion: number | undefined,
) => {
  const [draft, setDraft] = useState<EventEditDraft | null>(null);

  useEffect(() => {
    if (eventId === undefined || eventVersion === undefined) return;
    const kept = readEventEditDraft(eventId, eventVersion);
    if (kept) setDraft(kept);
  }, [eventId, eventVersion]);

  return {
    draft,
    change: (next: EventEditDraft) => {
      setDraft(next);
      if (eventId === undefined || eventVersion === undefined) return;
      writeEventEditDraft(eventId, eventVersion, next);
    },
    clear: () => {
      if (eventId !== undefined) clearEventEditDraft(eventId);
      setDraft(null);
    },
  };
};
