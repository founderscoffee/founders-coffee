import { z } from 'zod';

export const LOCALES = ['ar', 'en', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

export const localeSchema = z.enum(LOCALES);
