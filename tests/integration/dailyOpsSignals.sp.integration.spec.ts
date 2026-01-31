import { runListIntegration } from './_shared/runListIntegration';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';

const siteUrl = resolveSharePointSiteUrl();

const FIXED_DATE = '2000-01-01T00:00:00Z';

runListIntegration({
  name: 'DailyOpsSignals',
  siteUrl,
  listTitle: 'DailyOpsSignals',
  keyField: 'recordDate',
  selectFields: [
    'Title',
    'recordDate',
    'targetType',
    'targetId',
    'kind',
    'time',
    'summary',
    'status',
    'source',
  ],
  fixedKeyValue: FIXED_DATE,
  makeUpsertPayload: (key) => ({
    Title: 'E2E Signal',
    recordDate: key,
    targetType: 'User',
    targetId: 'E2E_INTEGRATION',
    kind: 'EarlyLeave',
    time: '11:00',
    summary: 'integration upsert',
    status: 'Active',
    source: 'E2E',
  }),
  deactivate: { field: 'status', value: 'Resolved' },
});
