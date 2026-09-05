import { z } from 'zod';

const coordinateSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);

const boundsSchema = z
  .tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
  ])
  .refine(
    ([west, south, east, north]) => west < east && south < north,
    'Map bounds must be ordered',
  );

const contextNameSchema = z
  .object({
    name: z.string().optional(),
    country_code: z.string().optional(),
  })
  .passthrough();

const contextRegionSchema = z
  .object({
    name: z.string().optional(),
    region_code: z.string().optional(),
    region_code_full: z.string().optional(),
  })
  .passthrough();

export const mapboxFeatureSchema = z
  .object({
    bbox: boundsSchema.optional(),
    geometry: z.object({ coordinates: coordinateSchema }),
    properties: z
      .object({
        mapbox_id: z.string().min(1),
        feature_type: z.string().min(1),
        name: z.string().min(1),
        full_address: z.string().optional(),
        place_formatted: z.string().optional(),
        bbox: boundsSchema.optional(),
        maki: z.string().optional(),
        poi_category: z.array(z.string()).optional(),
        poi_category_ids: z.array(z.string()).optional(),
        context: z
          .object({
            country: contextNameSchema.optional(),
            region: contextRegionSchema.optional(),
            district: contextNameSchema.optional(),
            place: contextNameSchema.optional(),
            locality: contextNameSchema.optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export const mapboxCollectionSchema = z
  .object({ features: z.array(mapboxFeatureSchema) })
  .passthrough();

export type MapboxFeature = z.infer<typeof mapboxFeatureSchema>;
