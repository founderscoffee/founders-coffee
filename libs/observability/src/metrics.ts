export interface MetricDimensions {
  readonly market?: string;
  readonly city?: string;
  readonly locale?: string;
}

export interface Metrics {
  readonly trackEvent: (event: string, dims?: MetricDimensions) => void;
  readonly trackCount: (
    event: string,
    value: number,
    dims?: MetricDimensions,
  ) => void;
}

/**
 * Shape an Analytics Engine data point: index1 = market (GROUP BY market for the
 * P1-019 dashboards), blob1 = event name (WHERE blob1 = …), blob2/3 = city/locale,
 * doubles = the measured values. Exported (pure) so the shape is testable without
 * touching the binding.
 */
export const buildDataPoint = (
  event: string,
  doubles: number[],
  dims: MetricDimensions,
): AnalyticsEngineDataPoint => ({
  indexes: [dims.market ?? 'global'],
  doubles,
  blobs: [event, dims.city ?? '', dims.locale ?? ''],
});

/**
 * Wrap a real Analytics Engine binding with typed helpers. Product events
 * (events created, RSVPs, density per city/market, payments confirmed) flow here
 * for the P1-019 dashboards (AGENTS.md §13). No env at module scope — pass the
 * binding (reached via `env.ANALYTICS` in the request) where you create the metrics.
 */
export const createMetrics = (analytics: AnalyticsEngineDataset): Metrics => ({
  trackEvent: (event, dims = {}) =>
    analytics.writeDataPoint(buildDataPoint(event, [1], dims)),
  trackCount: (event, value, dims = {}) =>
    analytics.writeDataPoint(buildDataPoint(event, [value], dims)),
});
