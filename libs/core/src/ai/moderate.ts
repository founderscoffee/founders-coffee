import { AppError, err, ok, type Result } from '../result.js';

import { MODERATION_MODEL } from './models.js';
import type { AiRuntime } from './ports.js';

export interface ModerationResult {
  readonly flagged: boolean;
  readonly categories: readonly string[];
  /** True when flagged OR when the model output was unparseable — moderation never auto-blocks; a
   * human reviews (hedge against Arabic/moderation false-positives). */
  readonly reviewRequired: boolean;
}

const MODERATION_SYSTEM = `You are a content moderator for a founder-community platform (Algeria-first; Arabic/French/English). Classify the user text. Respond with ONLY a compact JSON object and no prose: {"flagged": boolean, "categories": string[]}. categories drawn from: spam, harassment, hate, violence, sexual, misinformation. Be conservative across all three languages.`;

interface ParsedDecision {
  readonly flagged: boolean;
  readonly categories: readonly string[];
  readonly parsed: boolean;
}

/** Tolerantly extract the first {...} JSON object from an LLM response; null when absent/invalid. */
const extractJson = (response: string): unknown => {
  const start = response.indexOf('{');
  const end = response.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(response.slice(start, end + 1));
  } catch {
    return null;
  }
};

const parseDecision = (raw: unknown): ParsedDecision => {
  if (raw !== null && typeof raw === 'object' && 'flagged' in raw) {
    const flagged = (raw as { flagged?: unknown }).flagged === true;
    const categoriesRaw = (raw as { categories?: unknown }).categories;
    const categories = Array.isArray(categoriesRaw)
      ? categoriesRaw.filter((c): c is string => typeof c === 'string')
      : [];
    return { flagged, categories, parsed: true };
  }
  return { flagged: false, categories: [], parsed: false };
};

/**
 * Moderate text via an instruct LLM. Conservative by design: `reviewRequired` is true whenever the
 * text is flagged OR the model output can't be parsed (fail-safe → human looks). The caller (P2-E)
 * escalates flagged content to human review and never auto-blocks — a hedge against the higher
 * false-positive rate moderation models show on Arabic text.
 */
export const moderate = async (ai: AiRuntime, text: string): Promise<Result<ModerationResult>> => {
  if (text.trim().length === 0) {
    return ok({ flagged: false, categories: [], reviewRequired: false });
  }
  try {
    const raw = await ai.run(MODERATION_MODEL, {
      messages: [
        { role: 'system', content: MODERATION_SYSTEM },
        { role: 'user', content: text },
      ],
    });
    const response = (raw as { response?: unknown }).response;
    const decision = parseDecision(extractJson(typeof response === 'string' ? response : ''));
    return ok({
      flagged: decision.flagged,
      categories: decision.categories,
      reviewRequired: decision.flagged || !decision.parsed,
    });
  } catch (error) {
    return err(new AppError('ai_moderation_failed', error instanceof Error ? error.message : 'moderation failed'));
  }
};
