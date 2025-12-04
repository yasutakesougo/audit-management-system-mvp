import { describe, expect, it } from 'vitest';

import { ORG_MASTER_FIELDS, parseOrgMasterRows, type OrgMasterRecord } from './orgRowSchema';

const buildRawRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  [ORG_MASTER_FIELDS.id]: 12,
  [ORG_MASTER_FIELDS.title]: ' 全体会議 ',
  [ORG_MASTER_FIELDS.orgCode]: ' ORG-ALL ',
  [ORG_MASTER_FIELDS.orgType]: ' 会議 ',
  [ORG_MASTER_FIELDS.audience]: ['看護', '生活介護', '看護'],
  [ORG_MASTER_FIELDS.sortOrder]: 10,
  [ORG_MASTER_FIELDS.isActive]: true,
  [ORG_MASTER_FIELDS.notes]: ' 共有イベント ',
  ...overrides,
});

const parseOne = (row: Record<string, unknown>): OrgMasterRecord => parseOrgMasterRows([row])[0];

describe('orgRowSchema', () => {
  it('trims fields and keeps OrgCode as identifier', () => {
    const parsed = parseOne(buildRawRow());
    expect(parsed.id).toBe(12);
    expect(parsed.orgCode).toBe('ORG-ALL');
    expect(parsed.label).toBe('全体会議');
    expect(parsed.notes).toBe('共有イベント');
    expect(parsed.orgType).toBe('会議');
    expect(parsed.audience).toEqual(['看護', '生活介護']);
  });

  it('falls back to OrgCode as label when title missing', () => {
    const parsed = parseOne(
      buildRawRow({
        [ORG_MASTER_FIELDS.title]: '   ',
      }),
    );
    expect(parsed.label).toBe('ORG-ALL');
  });

  it('splits comma separated audience strings', () => {
    const parsed = parseOne(
      buildRawRow({
        [ORG_MASTER_FIELDS.audience]: '看護, 生活介護 ,  看護',
      }),
    );
    expect(parsed.audience).toEqual(['看護', '生活介護']);
  });

  it('defaults sort order and isActive when omitted', () => {
    const parsed = parseOne(
      buildRawRow({
        [ORG_MASTER_FIELDS.sortOrder]: undefined,
        [ORG_MASTER_FIELDS.isActive]: undefined,
      }),
    );
    expect(parsed.sortOrder).toBe(9999);
    expect(parsed.isActive).toBe(true);
  });

  it('accepts ID fallback when Id missing', () => {
    const parsed = parseOne({
      ID: 33,
      [ORG_MASTER_FIELDS.title]: 'タイトル',
      [ORG_MASTER_FIELDS.orgCode]: null,
    });
    expect(parsed.id).toBe(33);
    expect(parsed.label).toBe('タイトル');
  });
});
