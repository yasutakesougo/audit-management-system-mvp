// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateSchema } from '../validate-schema.logic.mjs';
import {
  ESSENTIAL_FIELDS,
  FIELD_ALIASES,
  OPTIONAL_FIELDS,
} from '../schemas/users.mjs';

describe('Users_Master schema validation', () => {
  it('accepts canonical logical InternalNames', () => {
    const result = validateSchema(
      [...ESSENTIAL_FIELDS, 'IsActive'],
      ESSENTIAL_FIELDS,
      OPTIONAL_FIELDS,
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.caseMismatch).toEqual([]);
    expect(result.resolved.UserID).toBe('UserID');
    expect(result.resolved.FullName).toBe('FullName');
  });

  it('accepts the known physical SharePoint InternalNames', () => {
    const result = validateSchema(
      ['User_x0020_ID', 'Full_x0020_Name', 'isActive0'],
      ESSENTIAL_FIELDS,
      OPTIONAL_FIELDS,
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.aliasResolutions).toEqual(expect.arrayContaining([
      expect.objectContaining({ logical: 'UserID', actual: 'User_x0020_ID' }),
      expect.objectContaining({ logical: 'FullName', actual: 'Full_x0020_Name' }),
      expect.objectContaining({ logical: 'IsActive', actual: 'isActive0' }),
    ]));
  });

  it('prefers canonical IsActive when canonical and alias fields coexist', () => {
    const result = validateSchema(
      ['UserID', 'FullName', 'IsActive', 'isActive0'],
      ESSENTIAL_FIELDS,
      ['IsActive'],
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(true);
    expect(result.resolved.IsActive).toBe('IsActive');
    expect(result.ambiguousOptional).toEqual([]);
  });

  it('warns on case-only IsActive drift while preserving the boolean field contract', () => {
    const result = validateSchema(
      ['UserID', 'FullName', 'isactive'],
      ESSENTIAL_FIELDS,
      ['IsActive'],
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(true);
    expect(result.resolved.IsActive).toBe('isactive');
    expect(result.caseMismatch).toEqual([]);
    expect(result.aliasResolutions).toEqual([
      expect.objectContaining({ logical: 'IsActive', actual: 'isactive', method: 'case-insensitive' }),
    ]);
  });

  it('still fails when an essential logical field has no physical match', () => {
    const result = validateSchema(
      ['User_x0020_ID'],
      ESSENTIAL_FIELDS,
      [],
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['FullName']);
  });

  it('keeps optional ambiguity as a warning rather than a schema failure', () => {
    const result = validateSchema(
      ['UserID', 'FullName', 'Full_x0020_Name_x0020_Kana', 'Full-Name-Kana'],
      ESSENTIAL_FIELDS,
      ['FullNameKana'],
      { aliases: { ...FIELD_ALIASES, FullNameKana: ['LegacyFullNameKana'] } },
    );

    expect(result.ok).toBe(true);
    expect(result.ambiguousEssential).toEqual([]);
    expect(result.ambiguousOptional).toEqual([
      {
        logical: 'FullNameKana',
        actual: ['Full_x0020_Name_x0020_Kana', 'Full-Name-Kana'],
      },
    ]);
  });
});
