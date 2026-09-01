import type { z } from 'zod';

import type { mapLocaleSchema } from './schemas.js';

export type MapLocale = z.infer<typeof mapLocaleSchema>;
