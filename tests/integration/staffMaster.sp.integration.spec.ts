import { runListIntegration } from './_shared/runListIntegration';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';

const siteUrl = resolveSharePointSiteUrl();
const isAppTest = siteUrl.includes('app-test');

const keyField = isAppTest ? 'Staff_x0020_ID' : 'StaffID';
const fullNameField = isAppTest ? 'Full_x0020_Name' : 'FullName';

const selectFields = isAppTest
  ? ['Title', fullNameField]
  : ['Title', 'FullName', 'Role', 'IsActive', 'Department', 'HireDate', 'Email'];

const makeUpsertPayload = (key: string) => {
  if (isAppTest) {
    return {
      Staff_x0020_ID: key,
      Title: `E2E Staff ${key}`,
      Full_x0020_Name: 'E2E Staff FullName',
    };
  }
  return {
    StaffID: key,
    Title: `E2E Staff ${key}`,
    FullName: 'E2E Staff FullName',
    Role: 'E2E',
    Department: 'E2E',
    Email: 'e2e.staff@example.com',
    IsActive: true,
  };
};

const deactivate = isAppTest
  ? undefined
  : { field: 'IsActive', value: false };

runListIntegration({
  name: 'Staff_Master',
  siteUrl,
  listTitle: 'Staff_Master',
  keyField,
  selectFields,
  fixedKeyValue: 'E2E_INTEGRATION_STAFF_0001',
  makeUpsertPayload,
  deactivate,
});
