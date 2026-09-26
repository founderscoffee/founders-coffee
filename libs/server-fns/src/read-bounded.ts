/**
 * Read a bounded body without trusting the length the client declared.
 *
 * `Content-Length` is a claim, and a chunked upload need not send one at all, so the cap is applied
 * to the bytes as they arrive. Reading the whole body first and measuring afterwards would let a
 * caller spend the Worker's memory on a request that was always going to be refused.
 */
export const readBounded = async (
  request: Request,
  limit: number,
): Promise<Uint8Array | null> => {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};
