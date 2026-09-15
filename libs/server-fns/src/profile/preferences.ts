import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  getAccountPreferences,
  getProfileIdentity,
  initializeMemberProfile,
  updateAccountPreferences,
  type Db,
} from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';
import { logger } from '@founders-coffee/observability';

type StoredPreferences = NonNullable<
  Awaited<ReturnType<typeof getAccountPreferences>>
>;

/**
 * Project the stored row into what the preferences screen is told.
 *
 * It is the saved policy, never the requested one. `smsFallbackEnabled` can be asked for and
 * refused — consent requires a currently verified number — so a response that echoed the input
 * would show a switch the store did not keep. `smsAvailable` is why the screen can say so instead
 * of offering a control whose save silently does nothing.
 *
 * `smsConsentAt` travels because it is evidence rather than decoration: server-owned, set when
 * consent is first given and cleared when it is withdrawn, so a member can see what they agreed to
 * and when.
 */
const view = (stored: StoredPreferences): profile.AccountPreferencesView =>
  profile.accountPreferencesViewSchema.parse({
    locale: stored.locale,
    revision: stored.preferences.revision,
    preferences: {
      eventUpdates: stored.preferences.eventUpdates,
      eventUpdatesChannels: profile.maskToChannels(
        stored.preferences.eventUpdatesChannels,
      ),
      eventReminders: stored.preferences.eventReminders,
      eventRemindersChannels: profile.maskToChannels(
        stored.preferences.eventRemindersChannels,
      ),
      hostUpdates: stored.preferences.hostUpdates,
      hostUpdatesChannels: profile.maskToChannels(
        stored.preferences.hostUpdatesChannels,
      ),
      followUpPrompts: stored.preferences.followUpPrompts,
      followUpPromptsChannels: profile.maskToChannels(
        stored.preferences.followUpPromptsChannels,
      ),
      pushEnabled: stored.preferences.pushEnabled,
      smsFallbackEnabled: stored.preferences.smsFallbackEnabled,
    },
    smsAvailable: stored.phoneVerified,
    smsConsentAt: stored.preferences.smsConsentAt?.toISOString() ?? null,
  });

const preferencesOperation = async <T>(
  operation: string,
  userId: string,
  run: () => Promise<Result<T>>,
): Promise<Result<T>> => {
  logger.info('preferences_requested', { operation, userId, scope: 'owner' });
  try {
    const result = await run();
    if (!result.ok)
      logger.warn('preferences_rejected', {
        operation,
        userId,
        code: result.error.code,
      });
    return result;
  } catch {
    logger.error('preferences_failed', { operation, userId, scope: 'owner' });
    return err(
      new AppError(
        'preferences_unavailable',
        'Preferences are temporarily unavailable',
      ),
    );
  }
};

/**
 * Read the member's saved delivery policy, creating the row if they have never had one.
 *
 * Initializing on read is deliberate and is a fix rather than a convenience. The preferences row is
 * created lazily by the first profile save, so a member who has never opened that screen has no
 * row — and `updateAccountPreferences` UPDATEs a row it requires to exist, which means the
 * preferences screen would load empty and every save on it would silently do nothing. Reading is
 * the moment the member is looking at the screen, so it is the right moment to make the row real.
 *
 * The insert is `ON CONFLICT DO NOTHING` against the member's own id, so a concurrent read and
 * profile save cannot produce two rows or overwrite one.
 */
export const readMyPreferences = (
  db: Db,
  userId: string,
): Promise<Result<profile.AccountPreferencesView>> =>
  preferencesOperation('read', userId, async () => {
    await initializeMemberProfile(db, userId);
    const stored = await getAccountPreferences(db, userId);
    if (!stored) return err(new AppError('not_found', 'Account not found'));
    return ok(view(stored));
  });

/**
 * Persist the requested policy and answer with the one that was actually saved.
 *
 * The store refuses in two distinguishable ways and returns `null` for both, so the reason is
 * recovered by reading back rather than guessed: no row at all means the identity is gone, a row
 * at a different revision means another session saved first, and a row at the expected revision
 * means the only remaining guard fired — SMS consent without a currently verified number.
 *
 * That last case is a refusal and not a silent downgrade. Saving the rest of the form and quietly
 * dropping the one switch the member came to turn on is how a settings screen ends up lying about
 * its own state, so nothing is written and the member is told which control cannot be set and why.
 *
 * `push_enabled` is absent from the input by construction and carried over from the stored row.
 * It is not a control the screen offers — browser permission cannot be set by a page — so it is
 * written by device registration and by nothing else. Accepting it here would let a form loaded
 * before a device was registered turn push back off on save, silently, with no control on screen
 * that the member could blame.
 *
 * The response is projected from the stored row, never echoed from the input: consent time is
 * server-owned, the revision is assigned by the store, and a screen that renders what it asked for
 * instead of what was kept is one refresh away from contradicting itself.
 */
export const saveMyPreferences = (
  db: Db,
  userId: string,
  input: profile.UpdateAccountPreferencesInput,
): Promise<Result<profile.AccountPreferencesView>> =>
  preferencesOperation('save', userId, async () => {
    await initializeMemberProfile(db, userId);
    const before = await getAccountPreferences(db, userId);
    if (!before) return err(new AppError('not_found', 'Account not found'));

    const {
      locale,
      expectedRevision,
      eventUpdatesChannels,
      eventRemindersChannels,
      hostUpdatesChannels,
      followUpPromptsChannels,
      ...categories
    } = input;
    const saved = await updateAccountPreferences(db, {
      userId,
      expectedRevision,
      locale,
      changes: {
        ...categories,
        eventUpdatesChannels: profile.channelsToMask(
          input.eventUpdates ? eventUpdatesChannels : [],
        ),
        eventRemindersChannels: profile.channelsToMask(
          input.eventReminders ? eventRemindersChannels : [],
        ),
        hostUpdatesChannels: profile.channelsToMask(
          input.hostUpdates ? hostUpdatesChannels : [],
        ),
        followUpPromptsChannels: profile.channelsToMask(
          input.followUpPrompts ? followUpPromptsChannels : [],
        ),
        pushEnabled: before.preferences.pushEnabled,
      },
    });

    if (!saved) {
      const current = await getAccountPreferences(db, userId);
      if (!current || !(await getProfileIdentity(db, userId)))
        return err(new AppError('not_found', 'Account not found'));
      if (current.preferences.revision !== expectedRevision)
        return err(
          new AppError(
            'preferences_conflict',
            'Preferences changed elsewhere; reload before saving',
          ),
        );
      return err(
        new AppError(
          'sms_consent_unavailable',
          'Verify a phone number before enabling the SMS fallback',
        ),
      );
    }

    const stored = await getAccountPreferences(db, userId);
    if (!stored) return err(new AppError('not_found', 'Account not found'));
    return ok(view(stored));
  });
