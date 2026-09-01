const DEFAULT_MAX_CHARS = 4000;

export const chunkText = (
  text: string,
  maxChars = DEFAULT_MAX_CHARS,
): string[] => {
  const clean = text.trim();
  if (clean.length === 0) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  for (let start = 0; start < clean.length; start += maxChars) {
    chunks.push(clean.slice(start, start + maxChars));
  }
  return chunks;
};
