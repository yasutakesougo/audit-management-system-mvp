import { runListIntegration } from './_shared/runListIntegration';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';
import { FIELD_ALIASES } from '../../scripts/ci/schemas/users.mjs';

const siteUrl = resolveSharePointSiteUrl();

runListIntegration({
  name: 'Users_Master',
  siteUrl,
  listTitle: 'Users_Master',
  keyField: 'UserID',
  selectFields: ['Title', 'FullName', 'Modified'],
  fieldAliases: FIELD_ALIASES,
  fixedKeyValue: 'E2E_INTEGRATION_USER_0001',
  makeUpsertPayload: (key) => ({
    UserID: key,
    Title: `E2E User ${key}`,
    FullName: 'E2E User FullName',
  }),
});
