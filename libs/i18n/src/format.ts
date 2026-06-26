import type { Money } from '@founders-coffee/core';

import type { Locale } from './locale.js';

/**
 * Locale-aware formatting over native `Intl.*` (full ICU on Workers, no flags).
 * **Latin digits forced everywhere** (`numberingSystem: 'latn'`) — overrides
 * CLDR's Arabic-Indic default for `ar` (SRS §8.6 decision). Formatters are cached
 * because construction is the expensive part on the edge.
 */

const ARABIC_INDIC = /[٠-٩]/;

const numberCache = new Map<string, Intl.NumberFormat>();
const numberFormatter = (locale: Locale, options: Intl.NumberFormatOptions) => {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = numberCache.get(key);
  if (cached) return cached;
  const fmt = new Intl.NumberFormat(locale, { numberingSystem: 'latn', ...options });
  numberCache.set(key, fmt);
  return fmt;
};

const dateCache = new Map<string, Intl.DateTimeFormat>();
const dateFormatter = (
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
) => {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = dateCache.get(key);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat(locale, { numberingSystem: 'latn', ...options });
  dateCache.set(key, fmt);
  return fmt;
};

/** Format a Money value (minor units) per locale; CLDR controls decimals. */
export const formatMoney = (money: Money, locale: Locale): string => {
  const major = money.amount_minor / 100;
  return numberFormatter(locale, { style: 'currency', currency: money.currency }).format(major);
};

/** Format a number per locale with Latin digits. */
export const formatNumber = (
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string => numberFormatter(locale, options).format(value);

/**
 * Format a date/time in the given IANA timezone per locale (SRS FR-L4 + §6 Time).
 * Pass the event's market/city timezone, not the viewer's.
 */
export const formatDate = (
  date: Date,
  locale: Locale,
  options: { timeZone: string } & Intl.DateTimeFormatOptions,
): string => dateFormatter(locale, options).format(date);

/** True if a formatted string is free of Arabic-Indic digits (Latin-digit guard). */
export const hasOnlyLatinDigits = (formatted: string): boolean =>
  !ARABIC_INDIC.test(formatted);
