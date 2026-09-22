import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyLocaleChoice } from './locale-choice';

beforeEach(() => {
  document.cookie = 'paraglide_locale=; path=/; max-age=0';
});

describe('recording a language the reader picked', () => {
  it('writes the cookie for a reader with no account to write to', async () => {
    const navigate = vi.fn();

    await applyLocaleChoice('fr', { navigate });

    expect(document.cookie).toContain('fr');
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('finishes saving to the account before it leaves the page', async () => {
    const order: string[] = [];
    const persist = vi.fn(async () => {
      await Promise.resolve();
      order.push('saved');
    });

    await applyLocaleChoice('en', {
      persist,
      navigate: () => order.push('navigated'),
    });

    expect(persist).toHaveBeenCalledWith('en');
    expect(
      order,
      'the navigation replaces the document, and a request still in flight when that happens never reaches the server, so the reader would arrive back in the language they just left',
    ).toEqual(['saved', 'navigated']);
  });

  it('still changes the language when the account cannot be reached', async () => {
    const navigate = vi.fn();

    await expect(
      applyLocaleChoice('fr', {
        persist: () => Promise.reject(new Error('offline')),
        navigate,
      }),
    ).resolves.toBeUndefined();

    expect(document.cookie).toContain('fr');
    expect(
      navigate,
      'the reader asked to read this page in another language, not to store a setting; the cookie has already granted that, so a failed save is not a reason to refuse it',
    ).toHaveBeenCalledOnce();
  });
});
