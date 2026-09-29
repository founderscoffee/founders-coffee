import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const styles = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8');

const LINE_HEIGHT = 'line-height: 1.65';
const NO_TRACKING = 'letter-spacing: 0';
const TYPEFACE = 'font-family: var(--font-arabic)';

const selectorsSetting = (declaration: string): string[] =>
  [...styles.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
    .filter(([, , body = '']) =>
      body.split(';').some((line) => line.trim() === declaration),
    )
    .map(([, selector = '']) =>
      selector.replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    )
    .filter((selector) => !selector.startsWith('@'));

const isSetOn = (element: Element, declaration: string): boolean =>
  selectorsSetting(declaration).some((selector) => element.matches(selector));

const renderPage = (locale: string) => {
  document.documentElement.lang = locale;
  return render(
    <article>
      <h1>
        <bdi>قهوة المؤسسين</bdi>
      </h1>
      <p>
        <span>من</span> <time>18:00</time> <a href="/">Café Atlas</a>{' '}
        <strong>مجاناً</strong> <em>الآن</em> <b>هنا</b> <i>قريباً</i>{' '}
        <small>ملاحظة</small> <abbr>GPS</abbr> <code>DZ</code>
        <button type="button">شارك</button>
        <input aria-label="البريد" />
      </p>
      <ul>
        <li>المضيف</li>
      </ul>
      <dl>
        <dd>12 Rue Didouche Mourad</dd>
      </dl>
      <label htmlFor="email">البريد الإلكتروني</label>
    </article>,
  );
};

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('lang');
});

describe('Arabic line height and tracking', () => {
  it('are set on the elements that hold lines, from the root down', () => {
    renderPage('ar');

    for (const element of [
      document.documentElement,
      ...document.querySelectorAll('body, div, article, h1, p, li, dd, label'),
    ])
      expect(
        isSetOn(element, LINE_HEIGHT) && isSetOn(element, NO_TRACKING),
        `${element.tagName} lost the Arabic line height`,
      ).toBe(true);
  });

  it('leave the text-level elements and controls to take both from their line', () => {
    const { container } = renderPage('ar');
    const inline = container.querySelectorAll('h1 > *, p > *');

    expect(inline).toHaveLength(13);
    for (const element of inline)
      for (const declaration of [LINE_HEIGHT, NO_TRACKING])
        expect(
          isSetOn(element, declaration),
          `${element.tagName} sets its own ${declaration}, which stretches any line whose block asks for less`,
        ).toBe(false);
  });

  it('keep the Arabic typeface on every element, the inline ones included', () => {
    const { container } = renderPage('ar');

    for (const element of container.querySelectorAll('*'))
      expect(isSetOn(element, TYPEFACE), element.tagName).toBe(true);
  });

  it('leave a French page alone', () => {
    const { container } = renderPage('fr');

    for (const element of container.querySelectorAll('*'))
      for (const declaration of [LINE_HEIGHT, TYPEFACE])
        expect(isSetOn(element, declaration), element.tagName).toBe(false);
  });
});
