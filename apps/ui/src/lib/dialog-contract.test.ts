import { describe, expect, it } from 'vitest';

import { declaredDialogs } from './dialog-contract.fixtures';

const DIALOGS = declaredDialogs();

const BACKDROP = /className="modal-backdrop"[^>]*>([\s\S]*?)<\/form>/gu;

const NAME_REFERENCE = /aria-labelledby=(?:\{(\w+)\}|"([^"]+)")/u;

describe('what a screen reader is told about a dialog', () => {
  it('finds the dialogs it is meant to be checking', () => {
    expect(
      DIALOGS.map((dialog) => dialog.file).sort(),
      'this suite reads source rather than a rendered tree, so a scan that quietly matched nothing would pass every claim below',
    ).toEqual([
      'components/events/CancelEventDialog.tsx',
      'components/events/RsvpCancelDialog.tsx',
      'components/events/ShareDialog.tsx',
      'components/shell/ProfileMenuDrawer.tsx',
      'features/account/components/ContactDialog.tsx',
      'features/events/components/PushPermissionPrompt.tsx',
    ]);
  });

  it.each(DIALOGS)('$file says what its dialog is', ({ tag }) => {
    expect(
      tag,
      'a dialog is named by aria-labelledby or aria-label; a heading inside it names nothing, so without one a screen reader announces an unnamed dialog',
    ).toMatch(/aria-label(ledby)?=/u);
  });

  it.each(DIALOGS)(
    '$file points its name at a heading that exists',
    ({ tag, source }) => {
      const [, expression, literal] = NAME_REFERENCE.exec(tag) ?? [];
      if (expression === undefined && literal === undefined) {
        expect(
          tag,
          'a dialog named by aria-label carries its name directly and has nothing to resolve; any other spelling of aria-labelledby is one this check cannot read, which is not the same as one that works',
        ).toMatch(/aria-label="/u);
        return;
      }

      expect(
        source,
        `${expression ?? literal} is the name this dialog claims, and a claim pointing at an id nothing carries leaves the dialog as unnamed as it was`,
      ).toContain(expression ? `id={${expression}}` : `id="${literal}"`);
    },
  );

  it.each(DIALOGS)('$file keeps its backdrop out of the way', ({ source }) => {
    for (const [, inside] of source.matchAll(BACKDROP))
      for (const required of ['aria-hidden="true"', 'tabIndex={-1}'])
        expect(
          inside,
          'a backdrop is a button the size of the viewport repeating a name the dialog already offers; it is there to be clicked past, not tabbed to, and hiding it while leaving it in the tab order strands a reader on something with no name at all',
        ).toContain(required);
  });
});
