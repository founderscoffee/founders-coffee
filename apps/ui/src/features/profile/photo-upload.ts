export interface PhotoUploadFailure {
  readonly code: string;
}

const CODE_BY_STATUS: Record<number, string> = {
  401: 'unauthenticated',
  413: 'photo_too_large',
  415: 'photo_unsupported',
  429: 'rate_limited',
  503: 'photo_storage_unavailable',
};

/**
 * Send the chosen file to the key a reservation just claimed.
 *
 * The body is the file itself rather than a form or an RPC envelope: a photo is already bytes, and
 * wrapping it in either would cost a copy and, in the JSON case, a third again in base64. The
 * response is small and always describes itself with a `code`, so the caller can say what went
 * wrong in the member's language instead of showing a status number.
 */
export const putProfilePhoto = async (
  assetId: string,
  file: Blob,
): Promise<{ ok: true } | { ok: false; error: PhotoUploadFailure }> => {
  const response = await fetch(`/api/profile/photo/${assetId}`, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': file.type || 'application/octet-stream' },
  });
  if (response.ok) return { ok: true };

  const body = (await response.json().catch(() => null)) as {
    code?: string;
  } | null;
  return {
    ok: false,
    error: {
      code: body?.code ?? CODE_BY_STATUS[response.status] ?? 'photo_failed',
    },
  };
};
