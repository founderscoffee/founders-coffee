import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';
import { useToast } from '@founders-coffee/ui';

import { ProfilePhotoField } from './ProfilePhotoField';
import { ProfileFeedback } from './ProfileFeedback';

const state = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  uploading: false,
}));

vi.mock('../hooks', () => ({
  usePhotoUpload: () => ({
    mutateAsync: state.upload,
    isPending: state.uploading,
  }),
  useRemovePhoto: () => ({ mutateAsync: state.remove, isPending: false }),
}));

const onPhotoChange = vi.fn();

const PhotoEditor = ({ photoAssetId }: { photoAssetId: string | null }) => {
  const feedback = useToast();
  return (
    <>
      <ProfilePhotoField
        locale="en"
        displayName="Amina Yagoub"
        photoAssetId={photoAssetId}
        onPhotoChange={onPhotoChange}
        onFeedback={feedback.show}
      />
      <ProfileFeedback
        locale="en"
        notification={feedback.notification}
        onDismiss={feedback.clear}
      />
    </>
  );
};
const show = (photoAssetId: string | null) =>
  render(<PhotoEditor photoAssetId={photoAssetId} />);

const chooseFile = () => {
  const input = screen.getByLabelText('Choose a photo') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'me.png', {
    type: 'image/png',
  });
  fireEvent.change(input, { target: { files: [file] } });
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  state.uploading = false;
});

describe('profile photo control', () => {
  it('falls back to initials, and offers neither removal nor publication', () => {
    show(null);

    expect(screen.getByText('AY')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('renders the stored photo through the eligibility-checked endpoint', () => {
    show('pha_abc');

    const image = screen.getByRole('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('/media/profile/pha_abc/md');
    expect(image.getAttribute('alt')).toBe('Your profile photo');
    expect(screen.getByRole('button', { name: 'Replace photo' })).toBeTruthy();
  });

  it('sends a chosen file and reports the new asset upward', async () => {
    state.upload.mockResolvedValue('pha_new');
    show(null);

    chooseFile();

    await waitFor(() => expect(onPhotoChange).toHaveBeenCalledWith('pha_new'));
    expect(screen.getByRole('status').textContent).toContain('Photo saved');
    expect(screen.getByRole('status').className).toContain('alert-success');
  });

  it('says what was wrong in the member’s language and keeps the old photo', async () => {
    state.upload.mockRejectedValue(
      new AppError('photo_too_small', 'Photo upload failed'),
    );
    show('pha_old');

    chooseFile();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('too small'),
    );
    expect(onPhotoChange).not.toHaveBeenCalled();
    expect((screen.getByRole('img') as HTMLImageElement).src).toContain(
      'pha_old',
    );
  });

  it('falls back to a general message for a code it does not know', async () => {
    state.upload.mockRejectedValue(new AppError('teapot', 'nope'));
    show(null);

    chooseFile();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'could not be saved',
      ),
    );
  });

  it('withdraws the photo and reports the removal upward', async () => {
    state.remove.mockResolvedValue({ removedAssetId: 'pha_old' });
    show('pha_old');

    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));

    await waitFor(() => expect(onPhotoChange).toHaveBeenCalledWith(null));
    expect(screen.getByRole('status').textContent).toContain('Photo removed');
  });

  it('has no publication switch even when a photo exists', () => {
    show('pha_abc');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Show publicly')).toBeNull();
  });

  it('blocks both actions while an upload is in flight', () => {
    state.uploading = true;
    show('pha_abc');

    expect(
      (
        screen.getByRole('button', {
          name: 'Replace photo',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Uploading…');
  });
});
