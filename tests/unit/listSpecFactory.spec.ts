// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FIELD_ALIASES } from '../../scripts/ci/schemas/users.mjs';
import { mapSchemaPayload } from '../../scripts/ci/resolve-schema-fields.mjs';
import { resolveListSpecFields } from '../integration/_shared/listSpecFactory';

const usersSpec = {
  name: 'Users_Master',
  siteUrl: 'https://example.sharepoint.com/sites/welfare',
  listTitle: 'Users_Master',
  keyField: 'UserID',
  selectFields: ['Title', 'FullName', 'IsActive', 'Modified'],
  fieldAliases: FIELD_ALIASES,
  fixedKeyValue: 'E2E_INTEGRATION_USER_0001',
  makeUpsertPayload: (key: string) => ({
    UserID: key,
    Title: `E2E User ${key}`,
    FullName: 'E2E User FullName',
    IsActive: true,
  }),
  deactivate: { field: 'IsActive', value: false },
};

describe('Users_Master list field resolution', () => {
  it('uses one logical-to-physical mapping for list operations', () => {
    const fields = resolveListSpecFields(usersSpec, [
      'Id',
      'Title',
      'User_x0020_ID',
      'Full_x0020_Name',
      'IsActive',
      'Modified',
    ]);

    expect(fields.keyField).toBe('User_x0020_ID');
    expect(fields.selectFields).toEqual([
      'Title',
      'Full_x0020_Name',
      'IsActive',
      'Modified',
    ]);
    expect(fields.deactivateField).toBe('IsActive');
    expect(mapSchemaPayload(usersSpec.makeUpsertPayload('E2E'), fields.logicalToPhysical)).toEqual({
      User_x0020_ID: 'E2E',
      Title: 'E2E User E2E',
      Full_x0020_Name: 'E2E User FullName',
      IsActive: true,
    });
  });

  it('keeps the canonical mapping when standard InternalNames are present', () => {
    const fields = resolveListSpecFields(usersSpec, [
      'Title',
      'UserID',
      'FullName',
      'IsActive',
      'Modified',
    ]);

    expect(fields.keyField).toBe('UserID');
    expect(fields.selectFields).toEqual(['Title', 'FullName', 'IsActive', 'Modified']);
  });

  it('maps IsActive alias consistently across select, deactivate, and payload', () => {
    const fields = resolveListSpecFields(usersSpec, [
      'Id',
      'Title',
      'UserID',
      'FullName',
      'isActive0',
      'Modified',
    ]);

    expect(fields.selectFields).toEqual(['Title', 'FullName', 'isActive0', 'Modified']);
    expect(fields.deactivateField).toBe('isActive0');

    const payload = mapSchemaPayload(
      usersSpec.makeUpsertPayload('E2E'),
      fields.logicalToPhysical,
    );
    expect(payload.isActive0).toBe(true);
    expect(typeof payload.isActive0).toBe('boolean');
  });
});
