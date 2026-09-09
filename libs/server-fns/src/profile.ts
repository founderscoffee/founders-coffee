import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { AppError, appValidator } from '@founders-coffee/core';

import { requirePermission } from './auth-middleware.js';
import { rateLimit } from './rate-limit.js';

export {
  getMyAccount,
  getMyProfile,
  getPhotoUploadAvailability,
  getPublicProfile,
  removeMyPhoto,
  reserveMyPhotoUpload,
  updateMyProfile,
  updateMyDisplayName,
} from './profile/rpc.js';
export {
  confirmMyEmailChange,
  confirmMyPhoneNumber,
  requestMyEmailChange,
  sendMyEmailChangeCode,
  sendMyPhoneCode,
} from './profile/contact-rpc.js';
export {
  getMyDevices,
  revokeMyDevice,
  unlinkMyProvider,
} from './profile/device-rpc.js';
export type {
  AccountSummary,
  DeviceList,
  SessionSummary,
  UserProfile,
  PublicProfile,
  UpdateProfileRequest,
  UpdateDisplayNameRequest,
} from './profile/schemas.js';

/** Retired compatibility endpoint: never persist residence, including for old clients. */
export const setHomeLocation = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('profile', 'update'),
    rateLimit('set_home_location', 10, 600_000),
  ])
  .validator(appValidator(z.unknown()))
  .handler(() => {
    throw new AppError(
      'client_refresh_required',
      'Reload to use the current profile',
    );
  });
