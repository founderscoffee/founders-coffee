import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { depConstraints } from './module-boundaries.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '../..');

const applications = [
  ['admin', 'layer:app-ui', 'domain:admin'],
  ['dashboard', 'layer:app-ui', 'domain:dashboard'],
  ['ui', 'layer:app-ui', 'domain:public'],
  ['worker-jobs', 'layer:server', 'domain:worker-jobs'],
];

const libraries = [
  ['auth', 'layer:server', 'domain:auth'],
  ['core', 'layer:shared', 'domain:core'],
  ['db', 'layer:data', 'domain:db'],
  ['domain', 'layer:domain', 'domain:domain'],
  ['email', 'layer:server', 'domain:email'],
  ['i18n', 'layer:shared', 'domain:i18n'],
  ['infra', 'layer:shared', 'domain:infra'],
  ['notifications', 'layer:server', 'domain:notifications'],
  ['observability', 'layer:shared', 'domain:observability'],
  ['payments', 'layer:server', 'domain:payments'],
  ['server-fns', 'layer:server', 'domain:server'],
  ['ui', 'layer:ui', 'domain:ui'],
];

const readTags = (projectType, name) => {
  const filePath = path.join(
    rootDirectory,
    projectType === 'app' ? 'apps' : 'libs',
    name,
    'project.json',
  );
  const project = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return project.tags ?? [];
};

const constraintFor = (sourceTag) =>
  depConstraints.find((constraint) => constraint.sourceTag === sourceTag);

const projectDirectories = (projectType) =>
  fs
    .readdirSync(
      path.join(rootDirectory, projectType === 'app' ? 'apps' : 'libs'),
      {
        withFileTypes: true,
      },
    )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

describe('Nx module boundary contract', () => {
  it('tags every application and library with type, domain, and layer metadata', () => {
    for (const [projectType, projects] of [
      ['app', applications],
      ['lib', libraries],
    ]) {
      const expectedDirectories = projects.map(([name]) => name).sort();
      expect(projectDirectories(projectType)).toEqual(expectedDirectories);
      for (const [name, layer, domain] of projects) {
        const tags = readTags(projectType, name);
        expect(tags).toContain(projectType === 'app' ? 'type:app' : 'type:lib');
        expect(tags).toContain(layer);
        expect(tags).toContain(domain);
      }
    }
  });

  it('tags every application with its explicit layer', () => {
    for (const [name, layer] of applications) {
      const tags = readTags('app', name);
      expect(tags).toContain('type:app');
      expect(tags).toContain(layer);
    }
  });

  it('tags every library with its explicit layer', () => {
    for (const [name, layer] of libraries) {
      const tags = readTags('lib', name);
      expect(tags).toContain('type:lib');
      expect(tags).toContain(layer);
    }
  });

  it('keeps application and library layer constraints explicit', () => {
    const expectedConstraints = [
      ['type:app', ['type:lib']],
      [
        'layer:app-ui',
        [
          'layer:ui',
          'layer:shared',
          'layer:server',
          'layer:domain',
          'layer:data',
        ],
      ],
      ['layer:ui', ['layer:ui', 'layer:shared']],
      [
        'layer:server',
        ['layer:server', 'layer:domain', 'layer:data', 'layer:shared'],
      ],
      ['layer:domain', ['layer:domain', 'layer:shared']],
      ['layer:data', ['layer:data', 'layer:shared']],
      ['layer:shared', ['layer:shared']],
    ];

    for (const [sourceTag, onlyDependOnLibsWithTags] of expectedConstraints) {
      expect(constraintFor(sourceTag)).toEqual({
        sourceTag,
        onlyDependOnLibsWithTags,
      });
    }
  });
});
