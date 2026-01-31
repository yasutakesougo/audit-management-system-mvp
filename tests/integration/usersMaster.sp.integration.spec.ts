import { runListIntegration } from './_shared/runListIntegration';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';

const siteUrl = resolveSharePointSiteUrl();

runListIntegration({
  name: 'Users_Master',
  siteUrl,
  listTitle: 'Users_Master',
  keyField: 'UserID',
  selectFields: ['Title', 'UserID', 'FullName', 'IsActive', 'Modified'],
  fixedKeyValue: 'E2E_INTEGRATION_USER_0001',
  makeUpsertPayload: (key) => ({
    UserID: key,
    Title: `E2E User ${key}`,
    FullName: 'E2E User FullName',
    IsActive: true,
  }),
  deactivate: { field: 'IsActive', value: false },
});
