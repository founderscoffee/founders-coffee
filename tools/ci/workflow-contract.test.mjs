import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = (name) =>
  fs.readFileSync(
    path.join(import.meta.dirname, '..', '..', '.github', 'workflows', name),
    'utf8',
  );

const ciWorkflow = workflow('ci.yml');
const deployWorkflow = workflow('deploy.yml');

describe('verified staging tree workflow contract', () => {
  it('does not accept caller-controlled reuse evidence', () => {
    expect(ciWorkflow).not.toContain('reuse_verified_staging_tree');
    expect(ciWorkflow).not.toContain('verified_source_run_url');
    expect(ciWorkflow).not.toContain('verified_source_tree');
  });

  it('requires internally generated evidence before it skips long verification', () => {
    expect(ciWorkflow).toContain(
      "needs.reuse-evidence.outputs.reuse != 'true'",
    );
    expect(ciWorkflow).toContain(
      'REUSE_EVIDENCE: ${{ needs.reuse-evidence.result }}',
    );
  });

  it('grants the reusable workflow only the read access its lookup needs', () => {
    expect(deployWorkflow).toContain('actions: read');
    expect(deployWorkflow).toContain('uses: ./.github/workflows/ci.yml');
  });
});
