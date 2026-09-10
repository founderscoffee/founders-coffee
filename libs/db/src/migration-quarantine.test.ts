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

  it('never ships a later migration ahead of a quarantined dependency', () => {
    const { journal, shipped } = manifest();
    const shippedFiles = new Set(shipped);
    const firstQuarantined = journal.findIndex(
      (tag) => !shippedFiles.has(fileFor(tag)),
    );

    if (firstQuarantined === -1) return;
    const laterTags = journal.slice(firstQuarantined + 1);

    expect(
      laterTags.filter((tag) => shippedFiles.has(fileFor(tag))),
      `${journal[firstQuarantined]} is still pending; dependent migrations must remain pending and be promoted in order.`,
    ).toEqual([]);
  });

  it('leaves the pending files out of the shipped directory', () => {
    const { shipped, pending } = manifest();
    for (const file of pending) expect(shipped).not.toContain(file);
  });
});
