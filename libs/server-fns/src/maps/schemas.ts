import { z } from 'zod';

import { marketCodeSchema } from '@founders-coffee/core';

export const mapLocaleSchema = z.enum(['ar', 'fr', 'en']);

const mapLocationSchema = z.object({
  marketCode: marketCodeSchema,
  cityCode: z.string().trim().min(1).max(32),
  locale: mapLocaleSchema,
});

export const hostMapContextSchema = mapLocationSchema;

export const venueSearchSchema = mapLocationSchema.extend({
  query: z.string().trim().min(2).max(80),
});

export const venueReverseSchema = mapLocationSchema.extend({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export type HostMapContextInput = z.infer<typeof hostMapContextSchema>;
export type VenueSearchInput = z.infer<typeof venueSearchSchema>;
export type VenueReverseInput = z.infer<typeof venueReverseSchema>;
