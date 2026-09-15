import { desc, eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { user, verification } from './schema.js';

export type ContactVerification = Pick<
  typeof verification.$inferSelect,
  'id' | 'identifier' | 'value' | 'expiresAt'
>;

export const getLatestContactVerification = async (
  db: Db,
  identifier: string,
): Promise<ContactVerification | undefined> => {
  const rows = await db
    .select({
      id: verification.id,
      identifier: verification.identifier,
      value: verification.value,
      expiresAt: verification.expiresAt,
    })
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .orderBy(desc(verification.createdAt))
    .limit(1);
  return rows[0];
};

export const updateContactVerificationValue = async (
  db: Db,
  id: string,
  value: string,
): Promise<void> => {
  await db
    .update(verification)
    .set({ value, updatedAt: new Date() })
    .where(eq(verification.id, id));
};

export const deleteContactVerifications = async (
  db: Db,
  identifier: string,
): Promise<void> => {
  await db.delete(verification).where(eq(verification.identifier, identifier));
};

export const hasUserWithEmail = async (
  db: Db,
  email: string,
): Promise<boolean> => {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .limit(1);
  return rows.length > 0;
};

export const hasUserWithPhone = async (
  db: Db,
  phoneNumber: string,
): Promise<boolean> => {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.phoneNumber, phoneNumber))
    .limit(1);
  return rows.length > 0;
};
