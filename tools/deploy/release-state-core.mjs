import fs from 'node:fs';
import path from 'node:path';

export const RELEASE_STATE_VERSION = 2;

export const ENVIRONMENT_CONFIG = {
  staging: {
    database: 'founders-coffee-db-staging',
    workers: {
      ui: 'founders-coffee-ui-staging',
      dashboard: 'founders-coffee-dashboard-staging',
      admin: 'founders-coffee-admin-staging',
      workerJobs: 'founders-coffee-worker-jobs-staging',
    },
  },
  production: {
    database: 'founders-coffee-db-production',
    workers: {
      ui: 'founders-coffee-ui-production',
      dashboard: 'founders-coffee-dashboard-production',
      admin: 'founders-coffee-admin-production',
      workerJobs: 'founders-coffee-worker-jobs-production',
    },
  },
};

const versionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const requireEnvironment = (environment) => {
  if (!Object.hasOwn(ENVIRONMENT_CONFIG, environment)) {
    throw new Error(`Unsupported environment: ${environment}`);
  }
  return environment;
};

const requireVersionId = (value, label) => {
  if (typeof value !== 'string' || !versionIdPattern.test(value)) {
    throw new Error(`${label} must be a Worker version id`);
  }
  return value;
};

const requireBookmark = (value) => {
  const hasControlCharacter =
    typeof value === 'string' &&
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    });
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 1024 ||
    hasControlCharacter
  ) {
    throw new Error('database bookmark must be a non-empty opaque value');
  }
  return value;
};

/*
 * Which migrations the database had already run when this state was captured. The capture step
 * runs before the deploy applies anything, so this is the schema the Workers named alongside it
 * were serving - the pairing a rollback needs to tell whether the schema has since moved past
 * the code it is being asked to restore.
 */
const requireAppliedMigrations = (value) => {
  if (
    !Array.isArray(value) ||
    value.some((name) => typeof name !== 'string' || !/^\d{4}_.+$/u.test(name))
  ) {
    throw new Error('appliedMigrations must list applied migration names');
  }
  return value;
};

const findValueByKey = (value, key) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValueByKey(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey.toLowerCase() === key && typeof entryValue === 'string') {
      return entryValue;
    }
  }
  for (const entryValue of Object.values(value)) {
    const found = findValueByKey(entryValue, key);
    if (found !== undefined) return found;
  }
  return undefined;
};

const deploymentsFromPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.result)) return payload.result;
  if (Array.isArray(payload.deployments)) return payload.deployments;
  if (isRecord(payload.result) && Array.isArray(payload.result.deployments)) {
    return payload.result.deployments;
  }
  return [];
};

const deploymentTimestamp = (deployment) =>
  Date.parse(
    deployment?.created_on ??
      deployment?.createdAt ??
      deployment?.created_at ??
      '',
  );

const containsVersionId = (value, versionId) => {
  if (Array.isArray(value))
    return value.some((item) => containsVersionId(item, versionId));
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, entryValue]) =>
    (key === 'version_id' || key === 'versionId') && entryValue === versionId
      ? true
      : containsVersionId(entryValue, versionId),
  );
};

export const hasVersionId = (payload, versionId) =>
  containsVersionId(payload, versionId);

export const extractActiveVersion = (payload, workerName) => {
  const deployments = deploymentsFromPayload(payload).filter(
    (item) => Array.isArray(item?.versions) && item.versions.length > 0,
  );
  const timestamps = deployments.map(deploymentTimestamp);
  if (
    deployments.length > 1 &&
    timestamps.every((timestamp) => !Number.isFinite(timestamp))
  ) {
    throw new Error(`${workerName} deployment history has no timestamps`);
  }
  const deployment = deployments
    .map((item, index) => ({
      item,
      timestamp: Number.isFinite(timestamps[index])
        ? timestamps[index]
        : Number.NEGATIVE_INFINITY,
    }))
    .sort((left, right) => right.timestamp - left.timestamp)
    .at(0)?.item;
  const versions = deployment?.versions ?? [];
  const active = versions.find((item) => Number(item?.percentage) === 100);
  const version = active ?? (versions.length === 1 ? versions[0] : undefined);
  const versionId = version?.version_id ?? version?.versionId ?? version?.id;
  requireVersionId(versionId, `${workerName} active version`);
  return {
    deploymentId: deployment?.id ?? deployment?.deployment_id ?? null,
    versionId,
    percentage: Number(version?.percentage ?? 100),
  };
};

export const extractBookmark = (payload) => {
  const bookmark = findValueByKey(payload, 'bookmark');
  return requireBookmark(bookmark);
};

export const latestMigration = (migrationDirectory) => {
  const journalPath = path.join(migrationDirectory, 'meta', '_journal.json');
  if (fs.existsSync(journalPath)) {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const tag = journal.entries?.at(-1)?.tag;
    if (typeof tag === 'string' && tag.length > 0) return tag;
  }
  const migrations = fs
    .readdirSync(migrationDirectory)
    .filter((file) => /^\d{4}_.+\.sql$/u.test(file))
    .sort();
  const latest = migrations.at(-1);
  if (!latest) throw new Error(`No migrations found in ${migrationDirectory}`);
  return latest.replace(/\.sql$/u, '');
};

export const validateReleaseState = (state) => {
  const environment = requireEnvironment(state?.environment);
  if (state?.schemaVersion !== RELEASE_STATE_VERSION) {
    throw new Error(
      `Unsupported release-state schema: ${state?.schemaVersion}`,
    );
  }
  if (
    typeof state?.capturedAt !== 'string' ||
    !Number.isFinite(Date.parse(state.capturedAt))
  ) {
    throw new Error('capturedAt must be an ISO timestamp');
  }
  if (
    typeof state?.migrationHead !== 'string' ||
    state.migrationHead.length === 0
  ) {
    throw new Error('migrationHead is required');
  }
  requireAppliedMigrations(state?.appliedMigrations);
  if (state?.database?.name !== ENVIRONMENT_CONFIG[environment].database) {
    throw new Error('database does not match the environment');
  }
  requireBookmark(state.database.bookmark);
  for (const [key, workerName] of Object.entries(
    ENVIRONMENT_CONFIG[environment].workers,
  )) {
    const worker = state?.workers?.[key];
    if (worker?.name !== workerName)
      throw new Error(`${key} Worker does not match the environment`);
    requireVersionId(worker.versionId, `${key} version`);
    if (worker.percentage !== 100)
      throw new Error(`${key} does not have a 100% active version`);
  }
  return state;
};

export const validateRollbackRequest = (request) => {
  if (
    Object.hasOwn(request, 'restoreDatabase') ||
    Object.hasOwn(request, 'databaseBookmark') ||
    Object.hasOwn(request, 'restoreConfirmation')
  ) {
    throw new Error('D1 restore is not part of the Worker rollback workflow');
  }
  const { environment, versions } = request;
  const target = requireEnvironment(environment);
  for (const key of Object.keys(ENVIRONMENT_CONFIG[target].workers)) {
    requireVersionId(versions?.[key], `${key} version`);
  }
  return { environment: target };
};
