import { env } from 'cloudflare:workers';

import { requireEnv } from '@founders-coffee/core';

import { createMapboxProvider } from './mapbox-provider.js';
import type { MapProvider } from './provider.js';

export const getMapProvider = (): MapProvider =>
  createMapboxProvider(
    requireEnv(env as Record<string, string | undefined>, 'MAPBOX_TOKEN'),
  );
