import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('P1-002 date badge typography', () => {
  it('uses the shared caption size and line-height instead of the tight overline scale', () => {
    const styles = readFileSync(
      new URL('./styles.css', import.meta.url),
      'utf8',
    );
    const dateStyle = styles.match(/\.datechip-line\s*\{([^}]+)\}/)?.[1];
    expect(dateStyle).toContain('font-size: var(--text-caption)');
    expect(dateStyle).toContain(
      'line-height: var(--text-caption--line-height)',
    );
    expect(dateStyle).not.toContain('overline');
  });
});
