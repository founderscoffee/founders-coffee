import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

const token = (name: string): string => {
  const value = styles.match(
    new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`),
  )?.[1];
  if (!value) throw new Error(`--color-${name} is missing from the theme`);
  return value;
};

const channel = (value: number): number =>
  value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

const luminance = (hex: string): number => {
  const packed = Number.parseInt(hex.slice(1), 16);
  const [red, green, blue] = [16, 8, 0].map((shift) =>
    channel(((packed >> shift) & 255) / 255),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string): number => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
};

const SURFACES = ['base-100', 'base-200', 'base-300'];

const ruleFor = (selector: string): string => {
  const body = styles.match(
    new RegExp(`${selector.replace(/[.:]/g, '\\$&')}\\s*\\{([^}]+)\\}`),
  )?.[1];
  if (!body) throw new Error(`${selector} is missing from the theme`);
  return body;
};

const colourOf = (selector: string): string => {
  const variable = ruleFor(selector).match(
    /color:\s*var\(--color-([\w-]+)\)/,
  )?.[1];
  if (!variable) throw new Error(`${selector} sets no colour from a token`);
  return token(variable);
};

describe('eyebrow label contrast', () => {
  it.each(SURFACES)('reads at AA on %s in every script', (surface) => {
    expect(
      contrast(colourOf('.eyebrow'), token(surface)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves the Arabic branch to size and weight, not colour', () => {
    expect(ruleFor(':lang\\(ar\\) .eyebrow')).not.toContain('color:');
  });

  it('keeps taupe off text, where it has never reached AA', () => {
    for (const surface of SURFACES)
      expect(contrast(token('taupe'), token(surface))).toBeLessThan(4.5);
    expect(colourOf('.eyebrow')).not.toBe(token('taupe'));
  });
});
