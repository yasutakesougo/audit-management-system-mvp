import { pathToFileURL } from 'node:url';
import {
  RuntimeGuardError,
  assertDiagnosticSafe,
  assertSafeFieldProjection,
  blockedAggregate,
  createGetOnlyTransport,
  createSafeReporter,
  runSnapshotPhase,
} from './runtime-non-persistence-core.mjs';

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

function buildDailyAllowedFields(env) {
  return assertSafeFieldProjection([
    'Id',
    'Title',
    'Created',
    'Modified',
    requireRuntimeValue(env, 'DRUIR_DAILY_USER_FIELD'),
    optionalRuntimeField(env, 'DRUIR_DAILY_RECORD_DATE_FIELD'),
    optionalRuntimeField(env, 'DRUIR_DAILY_ROW_NO_FIELD'),
    optionalRuntimeField(env, 'DRUIR_DAILY_STATUS_FIELD'),
    optionalRuntimeField(env, 'DRUIR_DAILY_RECORDED_AT_FIELD'),
  ].filter(Boolean));
}

function buildMasterAllowedFields(env) {
  return assertSafeFieldProjection([
    'Id',
    'Created',
    'Modified',
    requireRuntimeValue(env, 'DRUIR_MASTER_USERID_FIELD'),
  ]);
}

export function buildRuntimeConfig(env = process.env) {
  const siteUrl = requireRuntimeValue(env, 'DRUIR_SITE_URL');
  const dailyListTitle = requireRuntimeValue(env, 'DRUIR_DAILY_LIST_TITLE');
  const masterListTitle = requireRuntimeValue(env, 'DRUIR_MASTER_LIST_TITLE');
  const accessToken = requireRuntimeValue(env, 'DRUIR_SP_ACCESS_TOKEN');
  const expectedDailyListGuid = requireRuntimeValue(env, 'DRUIR_EXPECTED_DAILY_LIST_GUID');
  const expectedMasterListGuid = requireRuntimeValue(env, 'DRUIR_EXPECTED_MASTER_LIST_GUID');
  const masterUserIdField = requireRuntimeValue(env, 'DRUIR_MASTER_USERID_FIELD');

  const dailyAllowedFields = buildDailyAllowedFields(env);
  const masterAllowedFields = buildMasterAllowedFields(env);

  return {
    siteUrl,
    accessToken,
    config: {
      dailyListTitle,
      masterListTitle,
      expectedDailyListGuid,
      expectedMasterListGuid,
      dailyFields: [...dailyAllowedFields],
      masterFields: [...masterAllowedFields],
      dailyAllowedFields,
      masterAllowedFields,
      masterUserIdField,
    },
  };
}

export async function main({
  env = process.env,
  fetchImpl = globalThis.fetch,
  writeLine = (line) => process.stdout.write(line),
  execArgv = process.execArgv,
  nodeOptions = process.env.NODE_OPTIONS || '',
} = {}) {
  const reporter = createSafeReporter({ writeLine });

  if (!productionReadEnabled(env)) {
    reporter.report(blockedAggregate('LIVE_READ_DISABLED'));
    return 2;
  }

  try {
    assertDiagnosticSafe({ execArgv, nodeOptions, env });
    const { siteUrl, accessToken, config } = buildRuntimeConfig(env);
    const transport = createGetOnlyTransport({
      fetchImpl,
      siteUrl,
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
