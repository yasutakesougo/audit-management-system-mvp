import { describe, expect, it } from 'vitest';

import {
  EMPTY_ABSENT_LOG,
  buildNoteWithAbsentLog,
  formatAbsentSupportBrief,
  formatAbsentSupportNote,
} from '@/features/service-provision/domain/absentSupportLog';
import type { AbsentSupportLog } from '@/features/service-provision/domain/absentSupportLog';

const SAMPLE_LOG: AbsentSupportLog = {
  contactDateTime: '2026-02-27T08:10',
  contactPerson: '母',
  absenceReason: '発熱',
  supportContent: '水分摂取・受診を助言',
  followUpDateTime: '2026-02-27T17:00',
  followUpTarget: '母',
  followUpContent: '熱は下がった、明日利用予定',
  followUpResult: '実施',
  nextPlannedDate: '2026-02-28',
};

describe('formatAbsentSupportNote', () => {
  it('全項目入力 → 完全フォーマット', () => {
    const note = formatAbsentSupportNote(SAMPLE_LOG);
    expect(note).toContain('[欠席時対応]');
    expect(note).toContain('■受電: 2026-02-27T08:10 / 連絡者: 母');
    expect(note).toContain('理由: 発熱');
    expect(note).toContain('援助: 水分摂取・受診を助言');
    expect(note).toContain('■様子伺い: 2026-02-27T17:00 / 連絡先: 母 [実施]');
    expect(note).toContain('確認: 熱は下がった、明日利用予定');
    expect(note).toContain('次回: 2026-02-28');
  });

  it('空フィールド → （未入力）表示', () => {
    const note = formatAbsentSupportNote(EMPTY_ABSENT_LOG);
    expect(note).toContain('（未入力）');
  });

  it('不通の場合 → [不通] 表示', () => {
    const log: AbsentSupportLog = { ...SAMPLE_LOG, followUpResult: '不通', followUpContent: '留守電あり、折返し依頼' };
    const note = formatAbsentSupportNote(log);
    expect(note).toContain('[不通]');
    expect(note).toContain('留守電あり、折返し依頼');
  });
});

describe('buildNoteWithAbsentLog', () => {
  it('ログあり + メモあり → ログ先 + 区切り線 + メモ', () => {
    const result = buildNoteWithAbsentLog('手書きメモ', SAMPLE_LOG);
    expect(result).toMatch(/^\[欠席時対応\]/);
    expect(result).toContain('---');
    expect(result).toContain('手書きメモ');
  });

  it('ログあり + メモなし → ログのみ', () => {
    const result = buildNoteWithAbsentLog('', SAMPLE_LOG);
    expect(result).toContain('[欠席時対応]');
    expect(result).not.toContain('---');
  });

  it('ログなし → メモのみ', () => {
    const result = buildNoteWithAbsentLog('  手書きメモ  ', null);
    expect(result).toBe('手書きメモ');
  });
});

describe('formatAbsentSupportBrief', () => {
  it('全項目 → 短縮3行', () => {
    const brief = formatAbsentSupportBrief(SAMPLE_LOG);
    expect(brief).toContain('受電:');
    expect(brief).toContain('理由:発熱');
    expect(brief).toContain('次回:2026-02-28');
  });

  it('不通 → [不通] 表示', () => {
    const log = { ...SAMPLE_LOG, followUpResult: '不通' as const };
    const brief = formatAbsentSupportBrief(log);
    expect(brief).toContain('[不通]');
  });
});
