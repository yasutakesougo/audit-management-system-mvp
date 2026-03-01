import { describe, expect, it } from 'vitest';
import { normalizeTimeSlot, parseSupportTemplateCsv } from '../parseSupportTemplateCsv';

// ---------------------------------------------------------------------------
// normalizeTimeSlot
// ---------------------------------------------------------------------------
describe('normalizeTimeSlot', () => {
  it('normalizes "9:30〜10:30" → "09:30"', () => {
    expect(normalizeTimeSlot('9:30〜10:30')).toBe('09:30');
  });

  it('normalizes "12:40～13:45" → "12:40"', () => {
    expect(normalizeTimeSlot('12:40～13:45')).toBe('12:40');
  });

  it('normalizes "9:30頃" → "09:30"', () => {
    expect(normalizeTimeSlot('9:30頃')).toBe('09:30');
  });

  it('passes through already normalized "09:30"', () => {
    expect(normalizeTimeSlot('09:30')).toBe('09:30');
  });

  it('handles full-width colon "９：３0" gracefully', () => {
    // full-width numbers won't match regex, returns as-is
    expect(normalizeTimeSlot('９：３0')).toBe('９：３0');
  });

  it('returns raw string if no time pattern found', () => {
    expect(normalizeTimeSlot('午前中')).toBe('午前中');
  });
});

// ---------------------------------------------------------------------------
// parseSupportTemplateCsv
// ---------------------------------------------------------------------------
describe('parseSupportTemplateCsv', () => {
  const CSV_HEADER = 'タイトル,UserCode,RowNo,時間帯,活動内容,本人の動き,支援者の動き,UserLookupID';

  it('parses a single valid row into ScheduleItem', () => {
    const csv = [
      CSV_HEADER,
      '日課,I001,1,9:00〜9:30,朝の受け入れ,着替える,促す,10',
    ].join('\n');

    const result = parseSupportTemplateCsv(csv);
    expect(result.totalRows).toBe(1);
    expect(result.skippedRows).toBe(0);

    const items = result.data.get('I001');
    expect(items).toHaveLength(1);
    expect(items![0]).toEqual(
      expect.objectContaining({
        id: 'csv-I001-1',
        time: '09:00',
        activity: '朝の受け入れ - 着替える',
        instruction: '促す',
        isKey: false,
        linkedInterventionIds: [],
      }),
    );
  });

  it('groups items by UserCode', () => {
    const csv = [
      CSV_HEADER,
      '日課,I001,1,9:00,活動A,動きA,支援A,',
      '日課,I002,1,10:00,活動B,動きB,支援B,',
      '日課,I001,2,10:30,活動C,動きC,支援C,',
    ].join('\n');

    const result = parseSupportTemplateCsv(csv);
    expect(result.data.get('I001')).toHaveLength(2);
    expect(result.data.get('I002')).toHaveLength(1);
  });

  it('sorts items by time within the same user', () => {
    const csv = [
      CSV_HEADER,
      '日課,I001,3,15:00,午後活動,,午後支援,',
      '日課,I001,1,9:00,朝活動,,朝支援,',
      '日課,I001,2,12:00,昼活動,,昼支援,',
    ].join('\n');

    const result = parseSupportTemplateCsv(csv);
    const items = result.data.get('I001')!;
    expect(items.map((i) => i.time)).toEqual(['09:00', '12:00', '15:00']);
  });

  it('skips rows with missing UserCode', () => {
    const csv = [CSV_HEADER, '日課,,1,9:00,活動,,支援,'].join('\n');
    const result = parseSupportTemplateCsv(csv);
    expect(result.skippedRows).toBe(1);
    expect(result.data.size).toBe(0);
  });

  it('skips rows with missing 時間帯', () => {
    const csv = [CSV_HEADER, '日課,I001,1,,活動,,支援,'].join('\n');
    const result = parseSupportTemplateCsv(csv);
    expect(result.skippedRows).toBe(1);
  });

  it('skips rows with missing 活動内容', () => {
    const csv = [CSV_HEADER, '日課,I001,1,9:00,,,支援,'].join('\n');
    const result = parseSupportTemplateCsv(csv);
    expect(result.skippedRows).toBe(1);
  });

  it('uses activity alone when 本人の動き is empty', () => {
    const csv = [CSV_HEADER, '日課,I001,1,9:00,自由時間,,見守る,'].join('\n');
    const result = parseSupportTemplateCsv(csv);
    const items = result.data.get('I001')!;
    expect(items[0].activity).toBe('自由時間');
  });

  it('handles empty CSV gracefully', () => {
    const result = parseSupportTemplateCsv(CSV_HEADER);
    expect(result.totalRows).toBe(0);
    expect(result.skippedRows).toBe(0);
    expect(result.data.size).toBe(0);
  });
});
