import { AppError, err, ok, type Result } from '../result.js';

import { SUMMARIZE_MODEL } from './models.js';
import type { AiRuntime } from './ports.js';

const SUMMARIZE_SYSTEM = `Summarize the following text for a founder-community report in 1-2 sentences. Respond in the SAME language as the input (Arabic, French, or English). Output only the summary, no preamble.`;

/**
 * Summarize text via an instruct LLM (used for P3 sponsorship-report narratives). Empty input
 * short-circuits to an empty summary; a missing/blank model response surfaces as an error.
 */
export const summarize = async (ai: AiRuntime, text: string): Promise<Result<string>> => {
  if (text.trim().length === 0) return ok('');
  try {
    const raw = await ai.run(SUMMARIZE_MODEL, {
      messages: [
        { role: 'system', content: SUMMARIZE_SYSTEM },
        { role: 'user', content: text },
      ],
    });
    const response = (raw as { response?: unknown }).response;
    if (typeof response !== 'string' || response.trim().length === 0) {
      return err(new AppError('ai_summarize_failed', 'empty summary response'));
    }
    return ok(response.trim());
  } catch (error) {
    return err(new AppError('ai_summarize_failed', error instanceof Error ? error.message : 'summarize failed'));
  }
};
