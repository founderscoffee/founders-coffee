import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { AppError } from '@founders-coffee/core';
import { eq, user, type User } from '@founders-coffee/db';
import { geo } from '@founders-coffee/domain';

import { getDb } from './db.js';
import { requireAuth } from './authz.js';
import { authMiddleware } from './auth-middleware.js';

export interface UserProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
  readonly role: string;
  readonly homeMarketCode: string | null;
  readonly homeState: string | null;
  readonly homeCityId: string | null;
  readonly homeStateName: string | null;
  readonly homeCityName: string | null;
  readonly homeCityNameAr: string | null;
}

export interface PublicProfile {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
  readonly role: string;
  readonly homeCityName: string | null;
  readonly homeCityNameAr: string | null;
}

const resolveHomeNames = (
  u: User,
): Pick<UserProfile, 'homeStateName' | 'homeCityName' | 'homeCityNameAr'> => {
  const state =
    u.homeMarketCode && u.homeState
      ? geo.findState(u.homeMarketCode, u.homeState)
      : undefined;
  const city =
    u.homeMarketCode && u.homeCityId
      ? geo.findCity(u.homeMarketCode, u.homeCityId)
      : undefined;
  return {
    homeStateName: state?.name ?? null,
    homeCityName: city?.name ?? null,
    homeCityNameAr: city?.nameAr ?? null,
  };
};

const toUserProfile = (u: User): UserProfile => ({
  ...u,
  ...resolveHomeNames(u),
});

const toPublicProfile = (u: User): PublicProfile => {
  const names = resolveHomeNames(u);
  return {
    id: u.id,
    name: u.name,
    image: u.image,
    role: u.role,
    homeCityName: names.homeCityName,
    homeCityNameAr: names.homeCityNameAr,
  };
};

/** Get the current user's profile (with resolved geo names). Requires auth. */
export const getMyProfile = createServerFn({ strict: false })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const session = requireAuth(context.session);
    const db = getDb();
    const rows = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    if (!rows[0]) throw new AppError('not_found', 'User not found');
    return toUserProfile(rows[0]);
  });

/**
 * Set the current user's home location (onboarding / profile edit). Validates state + city against
 * the geo TS data, then writes directly to D1 (`input: false` blocks Better Auth's updateUser).
 */
export const setHomeLocation = createServerFn({ strict: false })
  .middleware([authMiddleware])
  .validator(
    z.object({
      marketCode: z.string(),
      state: z.string(),
      city: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    const state = geo.findState(data.marketCode, data.state);
    if (!state)
      throw new AppError(
        'validation_failed',
        `Unknown state ${data.state} for ${data.marketCode}`,
      );
    const city = geo.findCity(data.marketCode, data.city);
    if (!city)
      throw new AppError(
        'validation_failed',
        `Unknown city ${data.city} for ${data.marketCode}`,
      );
    const db = getDb();
    await db
      .update(user)
      .set({
        homeMarketCode: data.marketCode,
        homeState: data.state,
        homeCityId: data.city,
      })
      .where(eq(user.id, session.user.id))
      .run();
    return { ok: true as const };
  });

/** Get any user's public profile (FR-E7). No auth required. */
export const getPublicProfile = createServerFn({ strict: false })
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(user)
      .where(eq(user.id, data.userId))
      .limit(1);
    if (!rows[0]) throw new AppError('not_found', 'User not found');
    return toPublicProfile(rows[0]);
  });
