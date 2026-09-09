import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

type Manifest = {
  journal: string[];
  shipped: string[];
  pending: string[];
};

const manifest = (): Manifest =>
  (env as unknown as { MIGRATION_MANIFEST: Manifest }).MIGRATION_MANIFEST;

const fileFor = (tag: string) => `${tag}.sql`;

describe('migration quarantine', () => {
  it('keeps the journal and the shipped directory in step', () => {
    const { journal, shipped, pending } = manifest();
    const known = new Set([...shipped, ...pending]);

    for (const tag of journal) expect(known.has(fileFor(tag))).toBe(true);
    expect(shipped.length + pending.length).toBe(journal.length);
  });

  it('refuses to build a later migration on top of a quarantined one', () => {
    const { journal, shipped } = manifest();
    const shippedFiles = new Set(shipped);
    const firstQuarantined = journal.findIndex(
      (tag) => !shippedFiles.has(fileFor(tag)),
    );

    if (firstQuarantined === -1) return;
    const laterTags = journal.slice(firstQuarantined + 1);

    expect(
      laterTags,
      `${journal[firstQuarantined]} is still in pending-migrations, so ${laterTags.join(', ')} would be generated against a schema that has not shipped. Promote it first (PF-03b).`,
    ).toEqual([]);
  });

  it('leaves the pending files out of the shipped directory', () => {
    const { shipped, pending } = manifest();
    for (const file of pending) expect(shipped).not.toContain(file);
  });
});
