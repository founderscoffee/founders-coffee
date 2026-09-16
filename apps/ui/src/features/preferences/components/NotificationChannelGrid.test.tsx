import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NotificationDraft } from '../draft';
import { NotificationChannelGrid } from './NotificationChannelGrid';

const draft = (
  overrides: Partial<NotificationDraft> = {},
): NotificationDraft => ({
  eventUpdates: true,
  eventUpdatesChannels: ['push', 'email'],
  eventReminders: true,
  eventRemindersChannels: ['push', 'email'],
  hostUpdates: true,
  hostUpdatesChannels: ['push', 'email'],
  followUpPrompts: false,
  followUpPromptsChannels: [],
  pushEnabled: false,
  smsFallbackEnabled: false,
  ...overrides,
});

const show = (
  pushState: Parameters<typeof NotificationChannelGrid>[0]['pushState'],
  options: {
    current?: NotificationDraft;
    onEnablePush?: () => Promise<boolean>;
  } = {},
) =>
  render(
    <NotificationChannelGrid
      locale="en"
      draft={options.current ?? draft()}
      pushState={pushState}
      isEnabling={false}
      onEnablePush={options.onEnablePush ?? (async () => true)}
      onChange={vi.fn()}
    />,
  );

afterEach(() => cleanup());

describe('notification channel grid', () => {
  it.each([
    ['checking', 'Checking this device'],
    ['unsupported', 'This browser cannot receive notifications'],
    ['install_required', 'Add the app to your home screen'],
    ['unavailable', 'Notifications are not switched on for this site'],
    ['not_requested', 'Not asked for on this device'],
    ['denied', 'Blocked in this browser'],
    ['granted_unregistered', 'Allowed, but this device is not registered'],
    ['delivery_unavailable', 'this device was signed out'],
    ['registered', 'On, and reaching this device'],
  ] as const)('renders the %s push explanation', (pushState, text) => {
    show(pushState);

    expect(screen.getByText(new RegExp(text, 'i'))).toBeTruthy();
  });

  it('hides push controls when the deployment has no push provider', () => {
    show('unavailable');

    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(
      screen.queryByRole('checkbox', {
        name: /Reminders before a gathering: Notifications/i,
      }),
    ).toBeNull();
    expect(
      screen.getByText(/Notifications are not switched on for this site/i),
    ).toBeTruthy();
  });

  it('lets an unavailable push-only category switch to email', () => {
    const onChange = vi.fn();
    render(
      <NotificationChannelGrid
        locale="en"
        draft={draft({
          eventReminders: true,
          eventRemindersChannels: ['push'],
        })}
        pushState="unavailable"
        isEnabling={false}
        onEnablePush={async () => true}
        onChange={onChange}
      />,
    );

    const email = screen.getByRole('checkbox', {
      name: /Reminders before a gathering: Email/i,
    });
    expect((email as HTMLInputElement).checked).toBe(false);
    fireEvent.click(email);

    expect(onChange).toHaveBeenCalledWith({
      eventReminders: true,
      eventRemindersChannels: ['email'],
    });
  });

  it('uses the push cell itself as the permission gesture', async () => {
    const onEnablePush = vi.fn(async () => true);
    show('not_requested', {
      onEnablePush,
      current: draft({
        followUpPrompts: false,
        followUpPromptsChannels: [],
      }),
    });

    const pushCell = screen.getByRole('checkbox', {
      name: /After a gathering: Notifications/i,
    });
    fireEvent.click(pushCell);

    await waitFor(() => expect(onEnablePush).toHaveBeenCalledOnce());
  });

  it('does not select push when permission or registration fails', async () => {
    const onEnablePush = vi.fn(async () => false);
    const onChange = vi.fn();
    render(
      <NotificationChannelGrid
        locale="en"
        draft={draft({ followUpPrompts: false })}
        pushState="not_requested"
        isEnabling={false}
        onEnablePush={onEnablePush}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /After a gathering: Notifications/i,
      }),
    );

    await waitFor(() => expect(onEnablePush).toHaveBeenCalledOnce());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps a registered push cell available for a previously off category', () => {
    const onChange = vi.fn();
    render(
      <NotificationChannelGrid
        locale="en"
        draft={draft({
          eventReminders: false,
          eventRemindersChannels: [],
        })}
        pushState="registered"
        isEnabling={false}
        onEnablePush={async () => true}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Reminders before a gathering: Notifications/i,
      }),
    );

    expect(onChange).toHaveBeenCalledWith({
      eventReminders: true,
      eventRemindersChannels: ['push'],
    });
  });
});
