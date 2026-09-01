export interface AiRuntime {
  run(model: string, options: Record<string, unknown>): Promise<unknown>;
}

export interface VectorizeUpsertDoc {
  readonly id: string;
  readonly values: readonly number[];
  readonly metadata?: Record<string, unknown>;
}

export interface VectorizeMatch {
  readonly id: string;
  readonly score: number;
  readonly metadata?: Record<string, unknown>;
}

export interface VectorizeQueryOptions {
  readonly topK?: number;
  readonly filter?: Record<string, unknown>;
  readonly returnMetadata?: boolean;
}

export interface VectorizeRuntime {
  upsert(
    docs: readonly VectorizeUpsertDoc[],
  ): Promise<{ readonly ids: readonly string[] }>;
  query(
    vector: readonly number[],
    options: VectorizeQueryOptions,
  ): Promise<{ readonly matches: readonly VectorizeMatch[] }>;
}
