import { render } from '@react-email/render';
import { createElement, type FunctionComponent } from 'react';

export interface RenderedEmail {
  readonly html: string;
  readonly text: string;
}

/**
 * Render a React Email template to HTML + a plain-text fallback (two passes of react-dom/server,
 * proven on Workers by apps/web SSR). Templates take localized strings as props (resolved by the
 * caller via libs/i18n `m` at P1-009) — the template is pure layout; the base layout sets
 * `lang`/`dir` from the locale (FR-N3).
 */
export const renderEmail = async <Props extends object>(
  template: FunctionComponent<Props>,
  props: Props,
): Promise<RenderedEmail> => {
  const element = createElement(template, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
};
