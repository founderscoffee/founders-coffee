import { describe, expect, it } from 'vitest';

import { processWaitlistLaunch } from './waitlist-launch.js';
import {
  CAIRO,
  notifiedAt,
  noticesOf,
  publishMeetup,
  recordingDeps,
  recordingEmail,
  roundStatus,
  setupWaitlistDb,
  waitFor,
} from './waitlist-launch.fixtures.js';

describe('waitlist launch delivery', () => {
  it('tells everyone waiting for the city once, in their own language, and completes the round', async () => {
    const db = await setupWaitlistDb();
    const arabic = await waitFor(db, 'ar@example.com', 'ar');
    await waitFor(db, 'en@example.com', 'en');
    await waitFor(db, 'fr@example.com', 'fr');
    await waitFor(db, 'cairo@example.com', 'en', CAIRO);
    const meetup = await publishMeetup(db, {
      title: 'Algiers & founders morning',
    });
    const email = recordingEmail();
    const { deps, requeued } = recordingDeps(email.provider);

    expect((await processWaitlistLaunch(db, meetup.message, deps)).ok).toBe(
      true,
    );

    expect(email.sent.map((message) => message.to).sort()).toEqual([
      'ar@example.com',
      'en@example.com',
      'fr@example.com',
    ]);
    const to = (address: string) =>
      email.sent.find((message) => message.to === address);
    expect(to('en@example.com')?.subject).toBe(
      'A meetup is coming up in Algiers: Algiers & founders morning',
    );
    expect(to('fr@example.com')?.subject).toBe(
      'Une rencontre est prévue à Alger : Algiers & founders morning',
    );
    expect(to('ar@example.com')?.subject).toBe(
      'سيُعقد لقاء في الجزائر العاصمة: Algiers & founders morning',
    );
    expect(to('en@example.com')?.html).toContain(
      '<strong>Algiers &amp; founders morning</strong>',
    );
    expect(to('en@example.com')?.html).not.toContain('Algiers & founders');
    expect(to('en@example.com')?.text).toContain(
      `http://localhost:3000/en/algeria/e/${meetup.slug}`,
    );
    expect(to('fr@example.com')?.text).toContain(
      `http://localhost:3000/fr/algeria/e/${meetup.slug}`,
    );
    expect(to('en@example.com')?.text).toContain(
      'This is the only email we will send you about it.',
    );

    expect(await notifiedAt(db, arabic)).toBeInstanceOf(Date);
    expect(await roundStatus(db, meetup.message.launchId)).toBe('completed');
    expect(requeued).toHaveLength(0);
  });

  it('writes “au Caire” to a French reader waiting for Cairo', async () => {
    const db = await setupWaitlistDb();
    await waitFor(db, 'fr@example.com', 'fr', CAIRO);
    const meetup = await publishMeetup(db, { city: CAIRO });
    const email = recordingEmail();

    await processWaitlistLaunch(
      db,
      meetup.message,
      recordingDeps(email.provider).deps,
    );

    expect(email.sent[0]?.subject).toBe(
      'Une rencontre est prévue au Caire : Founders morning',
    );
    expect(email.sent[0]?.text).toContain(
      `quand une rencontre serait publiée au Caire.`,
    );
    expect(email.sent[0]?.text).toContain(`/fr/egypt/e/${meetup.slug}`);
  });

  it('tells whoever joins after a round completed about the next meetup, and nobody twice', async () => {
    const db = await setupWaitlistDb();
    const early = await waitFor(db, 'early@example.com');
    const first = await publishMeetup(db);
    const email = recordingEmail();
    const { deps } = recordingDeps(email.provider);
    await processWaitlistLaunch(db, first.message, deps);
    expect(await roundStatus(db, first.message.launchId)).toBe('completed');

    await waitFor(db, 'late@example.com');
    const second = await publishMeetup(db);
    await processWaitlistLaunch(db, second.message, deps);

    expect(email.sent.map((message) => message.to)).toEqual([
      'early@example.com',
      'late@example.com',
    ]);
    expect(await notifiedAt(db, early)).toBeInstanceOf(Date);
    expect(await roundStatus(db, second.message.launchId)).toBe('completed');
  });

  it('withdraws the round of a meetup that was cancelled or has started, sending nothing', async () => {
    const db = await setupWaitlistDb();
    const waiting = await waitFor(db, 'waiting@example.com');
    const cancelled = await publishMeetup(db, { status: 'cancelled' });
    const started = await publishMeetup(db, {
      startsAt: new Date(Date.now() - 60_000),
    });
    const email = recordingEmail();
    const { deps } = recordingDeps(email.provider);

    await processWaitlistLaunch(db, cancelled.message, deps);
    await processWaitlistLaunch(db, started.message, deps);

    expect(email.sent).toHaveLength(0);
    expect(await roundStatus(db, cancelled.message.launchId)).toBe('cancelled');
    expect(await roundStatus(db, started.message.launchId)).toBe('cancelled');
    expect(await notifiedAt(db, waiting)).toBeNull();
  });

  it('sends a list longer than one batch over two passes, handing the rest straight back', async () => {
    const db = await setupWaitlistDb();
    for (let index = 0; index < 60; index += 1)
      await waitFor(db, `waiting${index}@example.com`, 'en');
    const meetup = await publishMeetup(db);
    const email = recordingEmail();
    const { deps, requeued } = recordingDeps(email.provider);

    await processWaitlistLaunch(db, meetup.message, deps);
    expect(email.sent).toHaveLength(50);
    expect(requeued).toEqual([{ message: meetup.message, delaySeconds: 0 }]);
    expect(await roundStatus(db, meetup.message.launchId)).toBe('pending');

    await processWaitlistLaunch(db, meetup.message, deps);
    expect(email.sent).toHaveLength(60);
    expect(new Set(email.sent.map((message) => message.to)).size).toBe(60);
    expect(requeued).toHaveLength(1);
    expect(await roundStatus(db, meetup.message.launchId)).toBe('completed');
    expect(await noticesOf(db, meetup.message.launchId)).toHaveLength(60);
  });
});
