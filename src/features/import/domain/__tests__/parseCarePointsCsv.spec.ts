import { describe, expect, it } from 'vitest';
import { parseCarePointsCsv } from '../parseCarePointsCsv';

const CSV_HEADER = 'Usercode,PointText,IsActive,タイトル,UserLookupID';

describe('parseCarePointsCsv', () => {
  it('parses a valid row into a BIP draft', () => {
    const csv = [
      CSV_HEADER,
      'I001,はさみへのこだわりがある。紙切りの時間は必ず事前に見通しを持たせる。,1,注意事項,10',
    ].join('\n');

    const result = parseCarePointsCsv(csv);
    expect(result.totalRows).toBe(1);
    expect(result.skippedRows).toBe(0);

    const plans = result.data.get('I001');
    expect(plans).toHaveLength(1);

    const plan = plans![0];
    expect(plan.userId).toBe('I001');
    expect(plan.targetBehavior).toBe('はさみへのこだわりがある。紙切りの時間は…');
    expect(plan.strategies.prevention).toContain('はさみへのこだわりがある');
    expect(plan.strategies.alternative).toBe('');
    expect(plan.strategies.reactive).toBe('');
    expect(plan.triggerFactors).toEqual([]);
  });

  it('truncates targetBehavior to 20 chars + ellipsis', () => {
    const longText = 'あいうえおかきくけこさしすせそたちつてとなにぬねの';
    const csv = [CSV_HEADER, `I001,${longText},1,注意事項,`].join('\n');

    const result = parseCarePointsCsv(csv);
    const plan = result.data.get('I001')![0];
    expect(plan.targetBehavior.length).toBeLessThanOrEqual(21); // 20 + ellipsis
    expect(plan.targetBehavior).toMatch(/…$/);
  });

  it('uses full text as targetBehavior when ≤ 20 chars', () => {
    const shortText = '短いテキスト';
    const csv = [CSV_HEADER, `I001,${shortText},1,タイトル,`].join('\n');

    const result = parseCarePointsCsv(csv);
    const plan = result.data.get('I001')![0];
    expect(plan.targetBehavior).toBe(shortText);
  });

  it('skips inactive rows (IsActive = 0)', () => {
    const csv = [CSV_HEADER, 'I001,テスト,0,タイトル,'].join('\n');
    const result = parseCarePointsCsv(csv);
    expect(result.skippedRows).toBe(1);
    expect(result.data.size).toBe(0);
  });

  it('skips inactive rows (IsActive = false)', () => {
    const csv = [CSV_HEADER, 'I001,テスト,false,タイトル,'].join('\n');
    const result = parseCarePointsCsv(csv);
    expect(result.skippedRows).toBe(1);
  });

  it('includes rows with IsActive = 1', () => {
    const csv = [CSV_HEADER, 'I001,テスト,1,タイトル,'].join('\n');
    const result = parseCarePointsCsv(csv);
    expect(result.data.size).toBe(1);
  });

  it('skips rows with empty PointText', () => {
    const csv = [CSV_HEADER, 'I001,,1,タイトル,'].join('\n');
    const result = parseCarePointsCsv(csv);
    expect(result.skippedRows).toBe(1);
  });

  it('skips rows with empty Usercode', () => {
    const csv = [CSV_HEADER, ',テスト,1,タイトル,'].join('\n');
    const result = parseCarePointsCsv(csv);
    expect(result.skippedRows).toBe(1);
  });

  it('groups multiple plans for the same user', () => {
    const csv = [
      CSV_HEADER,
      'I001,注意事項1,1,タイトル,',
      'I001,注意事項2,1,タイトル,',
      'I002,注意事項3,1,タイトル,',
    ].join('\n');

    const result = parseCarePointsCsv(csv);
    expect(result.data.get('I001')).toHaveLength(2);
    expect(result.data.get('I002')).toHaveLength(1);
  });

  it('assigns sequential IDs per user', () => {
    const csv = [
      CSV_HEADER,
      'I001,テスト1,1,タイトル,',
      'I001,テスト2,1,タイトル,',
    ].join('\n');

    const result = parseCarePointsCsv(csv);
    const plans = result.data.get('I001')!;
    expect(plans[0].id).toBe('csv-care-I001-0');
    expect(plans[1].id).toBe('csv-care-I001-1');
  });
});
