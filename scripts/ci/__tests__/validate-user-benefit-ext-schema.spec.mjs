// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateSchema } from '../validate-schema.logic.mjs';
import {
  ESSENTIAL_FIELDS,
  FIELD_ALIASES,
} from '../schemas/user-benefit-ext.mjs';

describe('UserBenefit_Profile_Ext schema validation', () => {
  it('accepts the canonical logical InternalName', () => {
    const result = validateSchema(
      ['UserID'],
      ESSENTIAL_FIELDS,
      [],
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.caseMismatch).toEqual([]);
    expect(result.resolved.UserID).toBe('UserID');
  });

  it('resolves the encoded-space physical InternalName alias', () => {
    const result = validateSchema(
      ['User_x0020_ID'],
      ESSENTIAL_FIELDS,
      [],
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.resolved.UserID).toBe('User_x0020_ID');
    expect(result.aliasResolutions).toEqual([
      expect.objectContaining({
        logical: 'UserID',
        actual: 'User_x0020_ID',
        method: 'alias',
      }),
    ]);
  });

  it('keeps canonical resolution when both names are present', () => {
    const result = validateSchema(
      ['UserID', 'User_x0020_ID'],
      ESSENTIAL_FIELDS,
      [],
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(true);
    expect(result.resolved.UserID).toBe('UserID');
    expect(result.ambiguousEssential).toEqual([]);
  });

  it('retains the case-mismatch warning contract', () => {
    const result = validateSchema(
      ['userid'],
      ESSENTIAL_FIELDS,
      [],
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(true);
    expect(result.resolved.UserID).toBe('userid');
    expect(result.caseMismatch).toEqual([
      { expected: 'UserID', actual: 'userid' },
    ]);
  });

  it('fails when neither the canonical field nor its alias exists', () => {
    const result = validateSchema(
      ['Title'],
      ESSENTIAL_FIELDS,
      [],
      { aliases: FIELD_ALIASES },
    );

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['UserID']);
  });
});
