import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      {...rest}
    >
      {children}
    </a>
  ),
}));

import { RichText } from './RichText';

afterEach(cleanup);

const href = (name: string) =>
  screen.getByRole('link', { name }).getAttribute('href');

describe('rich text links', () => {
  it('sends a legal document to its locale-prefixed page', () => {
    render(<RichText locale="fr" value="Voir [la politique](/privacy)." />);

    expect(href('la politique')).toBe('/fr/privacy');
  });

  it('links a company page that is not one of the legal documents', () => {
    render(<RichText locale="fr" value="Voir [la FAQ](/faq)." />);

    expect(
      href('la FAQ'),
      'faq, about and contact are routed company pages the footer already links, but the renderer only knew the six legal paths',
    ).toBe('/fr/faq');
  });

  it.each(['about', 'contact', 'faq'])(
    'links the routed company page %s',
    (key) => {
      render(<RichText locale="ar" value={`اقرأ [الصفحة](/${key}) هنا`} />);

      expect(href('الصفحة')).toBe(`/ar/${key}`);
    },
  );

  it('shows the label, never the markup, for a target it cannot place', () => {
    render(<RichText locale="fr" value="Voir [ce texte](/pas-une-page)." />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(document.body.textContent).toContain('ce texte');
    expect(
      document.body.textContent,
      'an unresolvable target used to reach the reader as raw markdown, brackets and all',
    ).not.toMatch(/\]\(/u);
  });

  it('never leaves markdown markup on the page for a reader to see', () => {
    render(<RichText locale="ar" value="اقرأ [الأسئلة الشائعة](/faq) هنا" />);

    expect(
      document.body.textContent,
      'the fall-through renders the whole matched token, so an unresolved link shows the reader its brackets and parentheses',
    ).not.toMatch(/\]\(/u);
  });
});

describe('rich text formatting is unchanged', () => {
  it('renders bold and code spans', () => {
    render(<RichText locale="en" value="a **bold** and `code` span" />);

    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('code').tagName).toBe('CODE');
  });
});
