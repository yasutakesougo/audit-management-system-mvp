// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  mapSchemaPayload,
  resolveSchemaFields,
} from '../resolve-schema-fields.mjs';
import { FIELD_ALIASES } from '../schemas/users.mjs';

describe('resolveSchemaFields', () => {
  it('keeps canonical InternalNames when they are available', () => {
    const result = resolveSchemaFields(
      ['UserID', 'FullName', 'IsActive'],
      ['UserID', 'FullName', 'IsActive'],
      FIELD_ALIASES,
    );

    expect(result.missing).toEqual([]);
    expect(result.ambiguous).toEqual([]);
    expect(result.resolved).toEqual({
      UserID: 'UserID',
      FullName: 'FullName',
      IsActive: 'IsActive',
    });
    expect(result.resolutions.every(({ method }) => method === 'exact')).toBe(true);
  });

  it('resolves Users_Master logical fields to encoded physical InternalNames', () => {
    const result = resolveSchemaFields(
      ['Title', 'User_x0020_ID', 'Full_x0020_Name', 'IsActive'],
      ['UserID', 'FullName', 'Title', 'IsActive'],
      FIELD_ALIASES,
    );

    expect(result.missing).toEqual([]);
    expect(result.resolved.UserID).toBe('User_x0020_ID');
    expect(result.resolved.FullName).toBe('Full_x0020_Name');
  });

  it('fails unresolved logical fields instead of guessing', () => {
    const result = resolveSchemaFields(
      ['Title', 'User_x0020_ID'],
      ['UserID', 'FullName'],
      FIELD_ALIASES,
    );

    expect(result.missing).toEqual(['FullName']);
    expect(result.resolved.UserID).toBe('User_x0020_ID');
  });

  it('reports ambiguous normalized matches', () => {
    const result = resolveSchemaFields(
      ['User_x0020_ID', 'User-ID'],
      ['UserID'],
    );

    expect(result.missing).toEqual(['UserID']);
    expect(result.ambiguous).toEqual([
      { logical: 'UserID', actual: ['User_x0020_ID', 'User-ID'] },
    ]);
  });

  it('maps payload keys with the same logical-to-physical result', () => {
    expect(mapSchemaPayload(
      { UserID: 'E2E', FullName: 'Name', IsActive: true, Title: 'Title' },
      { UserID: 'User_x0020_ID', FullName: 'Full_x0020_Name', IsActive: 'IsActive', Title: 'Title' },
    )).toEqual({
      User_x0020_ID: 'E2E',
      Full_x0020_Name: 'Name',
      IsActive: true,
      Title: 'Title',
    });
  });
});
