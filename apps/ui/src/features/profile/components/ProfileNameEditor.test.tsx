import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UserProfile } from '../api';
import { ProfileCompletion } from './ProfileCompletion';
import { ProfileNameEditor } from './ProfileNameEditor';

const state = vi.hoisted(() => ({
  save: vi.fn(),
  reset: vi.fn(),
  refetch: vi.fn(),
  query: {
    data: undefined as UserProfile | undefined,
    userId: 'usr_1',
    isAuthLoading: false,
    isPending: false,
  },
}));
vi.mock('../hooks', () => ({
  useUpdateDisplayName: () => ({
    mutateAsync: state.save,
    reset: state.reset,
    isPending: false,
    isSuccess: false,
  }),
  useMyProfile: () => ({ ...state.query, refetch: state.refetch }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) =>
    createElement('a', { href: '/login' }, children),
}));

const owner: UserProfile = {
  userId: 'usr_1',
  displayName: '',
  revision: 0,
  photoAssetId: null,
  introduction: null,
  interests: [],
  spokenLanguages: [],
  professionalLink: null,
  visibility: {
    interests: false,
    spokenLanguages: false,
    professionalLink: false,
  },
};
const saveButton = () => screen.getByRole('button', { name: 'Save changes' });
const input = () => screen.getByRole('textbox', { name: 'Display name' });

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  state.query.data = undefined;
});

describe('PF-03 name editor', () => {
  it.each([
    ['ar', 'الاسم الظاهر'],
    ['fr', 'Nom affiché'],
    ['en', 'Display name'],
  ] as const)('labels the name-only form in %s', (locale, label) => {
    render(
      <ProfileNameEditor
        profile={owner}
        locale={locale}
        onReload={state.refetch}
      />,
    );
    expect(screen.getByRole('textbox', { name: label })).toBeTruthy();
    expect(document.querySelector('select')).toBeNull();
    expect(document.querySelectorAll('input')).toHaveLength(1);
  });
  it('focuses invalid input and never sends it', () => {
    render(
      <ProfileNameEditor
        profile={owner}
        locale="en"
        onReload={state.refetch}
      />,
    );
    fireEvent.click(saveButton());
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(document.activeElement).toBe(input());
    expect(state.save).not.toHaveBeenCalled();
  });
  it('sends one trimmed revision-checked update despite duplicate submits', async () => {
    let finish: (value: UserProfile) => void = () => undefined;
    state.save.mockImplementation(
      () =>
        new Promise<UserProfile>((resolve) => {
          finish = resolve;
        }),
    );
    const onSaved = vi.fn();
    render(
      <ProfileNameEditor
        profile={owner}
        locale="en"
        onReload={state.refetch}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(input(), { target: { value: '  Amina  ' } });
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(state.save).toHaveBeenCalledWith({
      displayName: 'Amina',
      expectedRevision: 0,
    });
    await act(async () =>
      finish({ ...owner, displayName: 'Amina', revision: 1 }),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it('keeps dirty text and its base revision across a background update; explicit reload resolves a conflict', async () => {
    state.save.mockRejectedValue({ code: 'profile_conflict' });
    const view = render(
      <ProfileNameEditor
        profile={owner}
        locale="en"
        onReload={state.refetch}
      />,
    );
    fireEvent.change(input(), { target: { value: 'Unsaved' } });
    const newer = { ...owner, displayName: 'Other tab', revision: 1 };
    view.rerender(
      <ProfileNameEditor
        profile={newer}
        locale="en"
        onReload={state.refetch}
      />,
    );
    fireEvent.click(saveButton());
    await screen.findByRole('alert');
    expect(state.save).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Unsaved', expectedRevision: 0 }),
    );
    expect((input() as HTMLInputElement).value).toBe('Unsaved');
    state.refetch.mockResolvedValue(newer);
    fireEvent.click(screen.getByRole('button', { name: 'Reload profile' }));
    await waitFor(() =>
      expect((input() as HTMLInputElement).value).toBe('Other tab'),
    );
    state.save.mockResolvedValue({ ...newer, revision: 2 });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(state.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedRevision: 1 }),
      ),
    );
  });
  it('offers cancel only while dirty and restores the saved name', () => {
    render(
      <ProfileNameEditor
        profile={owner}
        locale="en"
        onReload={state.refetch}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    fireEvent.change(input(), { target: { value: 'Edited name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect((input() as HTMLInputElement).value).toBe(owner.displayName);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(state.save).not.toHaveBeenCalled();
  });

  it('tells its owner when edits are pending and when they are not', () => {
    const onDirtyChange = vi.fn();
    const view = render(
      <ProfileNameEditor
        profile={owner}
        locale="en"
        onDirtyChange={onDirtyChange}
        onReload={state.refetch}
      />,
    );

    fireEvent.change(input(), { target: { value: 'Edited name' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.change(input(), { target: { value: owner.displayName } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    view.unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

describe('PF-03 completion handoff', () => {
  it('resumes a named member once without optional details', () => {
    state.query.data = { ...owner, displayName: 'Amina' };
    const complete = vi.fn();
    const view = render(
      <ProfileCompletion
        locale="en"
        returnPath="/profile"
        onComplete={complete}
      />,
    );
    view.rerender(
      <ProfileCompletion
        locale="en"
        returnPath="/profile"
        onComplete={complete}
      />,
    );
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it('does not resume Publish after the member cancels while a name save is in flight', async () => {
    state.query.data = owner;
    let finish: (value: UserProfile) => void = () => undefined;
    state.save.mockImplementation(
      () =>
        new Promise<UserProfile>((resolve) => {
          finish = resolve;
        }),
    );
    const complete = vi.fn();
    const view = render(
      <ProfileCompletion
        locale="en"
        returnPath="/profile"
        onComplete={complete}
      />,
    );
    fireEvent.change(input(), { target: { value: 'Amina' } });
    fireEvent.click(saveButton());
    view.unmount();
    await act(async () =>
      finish({ ...owner, displayName: 'Amina', revision: 1 }),
    );
    expect(complete).not.toHaveBeenCalled();
  });
});
