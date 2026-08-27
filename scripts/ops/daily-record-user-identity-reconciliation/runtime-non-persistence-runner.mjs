import { pathToFileURL } from 'node:url';
import {
  RuntimeGuardError,
  assertSafeFieldProjection,
  blockedAggregate,
  createGetOnlyTransport,
  createSafeReporter,
  runSnapshotPhase,
} from './runtime-non-persistence-core.mjs';

const SITE_URL = 'https://isogokatudouhome.sharepoint.com/sites/welfare';
const DAILY_LIST_TITLE = 'DailyRecordRows';
const MASTER_LIST_TITLE = 'Users_Master';

function requireRuntimeValue(env, key) {
  const value = String(env?.[key] || '').trim();
  if (!value) throw new RuntimeGuardError('MISSING_RUNTIME_CONFIG');
  return value;
}

function optionalRuntimeField(env, key) {
  const value = String(env?.[key] || '').trim();
  return value || null;
}

export function productionReadEnabled(env = process.env) {
  return String(env?.DRUIR_ENABLE_PRODUCTION_READ || '').trim() === 'GO';
}

export function buildRuntimeConfig(env = process.env) {
  const accessToken = requireRuntimeValue(env, 'DRUIR_SP_ACCESS_TOKEN');
  const expectedDailyListGuid = requireRuntimeValue(env, 'DRUIR_EXPECTED_DAILY_LIST_GUID');
  const expectedMasterListGuid = requireRuntimeValue(env, 'DRUIR_EXPECTED_MASTER_LIST_GUID');
  const dailyUserField = requireRuntimeValue(env, 'DRUIR_DAILY_USER_FIELD');
  const masterUserIdField = requireRuntimeValue(env, 'DRUIR_MASTER_USERID_FIELD');

  const dailyFields = [
    'Id',
    'Title',
    'Created',
    'Modified',
    dailyUserField,
    optionalRuntimeField(env, 'DRUIR_DAILY_RECORD_DATE_FIELD'),
    optionalRuntimeField(env, 'DRUIR_DAILY_ROW_NO_FIELD'),
    optionalRuntimeField(env, 'DRUIR_DAILY_STATUS_FIELD'),
    optionalRuntimeField(env, 'DRUIR_DAILY_RECORDED_AT_FIELD'),
  ].filter(Boolean);

  const masterFields = ['Id', 'Created', 'Modified', masterUserIdField];

  return {
    accessToken,
    config: {
      dailyListTitle: DAILY_LIST_TITLE,
      masterListTitle: MASTER_LIST_TITLE,
      expectedDailyListGuid,
      expectedMasterListGuid,
      dailyFields: assertSafeFieldProjection(dailyFields),
      masterFields: assertSafeFieldProjection(masterFields),
      masterUserIdField,
    },
  };
}

export async function main({
  env = process.env,
  fetchImpl = globalThis.fetch,
  writeLine = (line) => process.stdout.write(line),
} = {}) {
  const reporter = createSafeReporter({ writeLine });

  if (!productionReadEnabled(env)) {
    reporter.report(blockedAggregate('LIVE_READ_DISABLED'));
    return 2;
  }

  try {
    const { accessToken, config } = buildRuntimeConfig(env);
    const transport = createGetOnlyTransport({
      fetchImpl,
      siteUrl: SITE_URL,
      accessToken,
    });
    const aggregate = await runSnapshotPhase({ transport, config });
    reporter.report(aggregate);
    return aggregate.runtimeStatus === 'READY' ? 0 : 2;
  } catch (error) {
    const code = error instanceof RuntimeGuardError ? error.code : 'RUNTIME_FAILURE';
    reporter.report(blockedAggregate(code));
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      process.exitCode = 2;
    });
}
