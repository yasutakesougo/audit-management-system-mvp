import { runListIntegration } from './_shared/runListIntegration';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';

const siteUrl = resolveSharePointSiteUrl();

runListIntegration({
  name: 'Staff_Master',
  siteUrl,
  listTitle: 'Staff_Master',
  keyField: 'StaffID',
  selectFields: [
    'Title',
    'StaffID',
    'FullName',
    'Role',
    'IsActive',
    'Department',
    'HireDate',
    'Email',
  ],
  fixedKeyValue: 'E2E_INTEGRATION_STAFF_0001',
  makeUpsertPayload: (key) => ({
    StaffID: key,
    Title: `E2E Staff ${key}`,
    FullName: 'E2E Staff FullName',
    Role: 'E2E',
    Department: 'E2E',
    Email: 'e2e.staff@example.com',
    IsActive: true,
  }),
  deactivate: { field: 'IsActive', value: false },
});
