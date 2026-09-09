import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useMyProfile,
  usePhotoUpload,
  usePublicProfile,
  useRemovePhoto,
} from './hooks';

const state = vi.hoisted(() => ({
  assetId: null as string | null,
  nextAssetId: 'pha_first',
  put: vi.fn(),
  invalidateRouter: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: state.invalidateRouter }),
}));
vi.mock('../../lib/auth', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: 'usr_owner' } },
      isPending: false,
    }),
  },
}));
vi.mock('./photo-upload', () => ({ putProfilePhoto: state.put }));
vi.mock('./api', () => ({
  profileApi: {
    getMyProfile: async () => ({
      userId: 'usr_owner',
      photoAssetId: state.assetId,
    }),
    getPublicProfile: async () => ({
      userId: 'usr_owner',
      photoAssetId: state.assetId,
    }),
    reservePhoto: async () => ({ assetId: state.nextAssetId }),
    removePhoto: async () => {
      state.assetId = null;
    },
  },
}));

let cache: QueryClient;
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={cache}>{children}</QueryClientProvider>
);

beforeEach(() => {
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.assetId = null;
  state.nextAssetId = 'pha_first';
  state.put.mockImplementation(async (assetId: string) => {
    state.assetId = assetId;
    return { ok: true };
  });
});
afterEach(() => {
  cleanup();
  cache.clear();
  vi.resetAllMocks();
});

describe('photo mutation query synchronization', () => {
  it('refreshes header/owner and public observers after upload, replacement and removal', async () => {
    const { result } = renderHook(
      () => ({
        owner: useMyProfile(),
        public: usePublicProfile('usr_owner'),
        upload: usePhotoUpload(),
        remove: useRemovePhoto(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.owner.isSuccess).toBe(true));
    for (const assetId of ['pha_first', 'pha_replaced']) {
      state.nextAssetId = assetId;
      await act(() =>
        result.current.upload.mutateAsync({ file: new Blob(['image']) }),
      );
      await waitFor(() => {
        expect(result.current.owner.data?.photoAssetId).toBe(assetId);
        expect(result.current.public.data?.photoAssetId).toBe(assetId);
      });
    }
    await act(() => result.current.remove.mutateAsync(undefined));
    await waitFor(() => {
      expect(result.current.owner.data?.photoAssetId).toBeNull();
      expect(result.current.public.data?.photoAssetId).toBeNull();
    });
    expect(state.invalidateRouter).toHaveBeenCalledTimes(3);
  });

  it('keeps the saved photo when upload fails', async () => {
    state.assetId = 'pha_existing';
    state.put.mockResolvedValue({
      ok: false,
      error: { code: 'photo_unsupported' },
    });
    const { result } = renderHook(
      () => ({ owner: useMyProfile(), upload: usePhotoUpload() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.owner.isSuccess).toBe(true));
    await act(async () => {
      await expect(
        result.current.upload.mutateAsync({ file: new Blob(['bad']) }),
      ).rejects.toMatchObject({ code: 'photo_unsupported' });
    });
    expect(result.current.owner.data?.photoAssetId).toBe('pha_existing');
    expect(state.invalidateRouter).not.toHaveBeenCalled();
  });
});
