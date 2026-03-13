/**
 * aggregateIcebergEvidence.spec.ts
 *
 * IcebergPdcaItem[] → IcebergEvidenceBySheet 変換の単体テスト
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateIcebergEvidence,
  type IcebergPdcaSummarySource,
} from '@/domain/regulatory/aggregateIcebergEvidence';

// ── helpers ──

const item = (
  planningSheetId: string | undefined,
  updatedAt: string,
): IcebergPdcaSummarySource => ({ planningSheetId, updatedAt });

// ── tests ──

describe('aggregateIcebergEvidence', () => {
  it('空配列 → 空レコード', () => {
    const result = aggregateIcebergEvidence([]);
    expect(result.sessionCount).toEqual({});
    expect(result.latestAnalysisDate).toEqual({});
  });

  it('planningSheetId なしアイテムをスキップ', () => {
    const result = aggregateIcebergEvidence([
      item(undefined, '2026-03-01T12:00:00Z'),
      item(undefined, '2026-03-02T12:00:00Z'),
    ]);
    expect(result.sessionCount).toEqual({});
    expect(result.latestAnalysisDate).toEqual({});
  });

  it('単一シートの単一アイテム → カウント1 + 日付', () => {
    const result = aggregateIcebergEvidence([
      item('sheet-1', '2026-03-10T09:00:00Z'),
    ]);
    expect(result.sessionCount).toEqual({ 'sheet-1': 1 });
    expect(result.latestAnalysisDate).toEqual({ 'sheet-1': '2026-03-10' });
  });

  it('同一シートの複数アイテム → カウント加算 + 最新日付', () => {
    const result = aggregateIcebergEvidence([
      item('sheet-1', '2026-03-05T09:00:00Z'),
      item('sheet-1', '2026-03-10T09:00:00Z'),
      item('sheet-1', '2026-03-08T09:00:00Z'),
    ]);
    expect(result.sessionCount).toEqual({ 'sheet-1': 3 });
    expect(result.latestAnalysisDate).toEqual({ 'sheet-1': '2026-03-10' });
  });

  it('複数シートの独立集計', () => {
    const result = aggregateIcebergEvidence([
      item('sheet-1', '2026-03-05T09:00:00Z'),
      item('sheet-2', '2026-03-08T09:00:00Z'),
      item('sheet-1', '2026-03-10T09:00:00Z'),
    ]);
    expect(result.sessionCount).toEqual({ 'sheet-1': 2, 'sheet-2': 1 });
    expect(result.latestAnalysisDate).toEqual({
      'sheet-1': '2026-03-10',
      'sheet-2': '2026-03-08',
    });
  });

  it('planningSheetId ありなし混在 → ありのみ集計', () => {
    const result = aggregateIcebergEvidence([
      item('sheet-1', '2026-03-01T09:00:00Z'),
      item(undefined, '2026-03-05T09:00:00Z'),
      item('sheet-1', '2026-03-03T09:00:00Z'),
    ]);
    expect(result.sessionCount).toEqual({ 'sheet-1': 2 });
    expect(result.latestAnalysisDate).toEqual({ 'sheet-1': '2026-03-03' });
  });

  it('ISO datetime の日付部分のみ比較（時間は無視）', () => {
    const result = aggregateIcebergEvidence([
      item('sheet-1', '2026-03-10T23:59:59Z'),
      item('sheet-1', '2026-03-10T00:00:00Z'),
    ]);
    // 同じ日付 → 最新は変わらず
    expect(result.sessionCount).toEqual({ 'sheet-1': 2 });
    expect(result.latestAnalysisDate).toEqual({ 'sheet-1': '2026-03-10' });
  });

  it('日付のみのフォーマット（T なし）にも対応', () => {
    const result = aggregateIcebergEvidence([
      item('sheet-1', '2026-03-01'),
      item('sheet-1', '2026-03-15'),
    ]);
    expect(result.sessionCount).toEqual({ 'sheet-1': 2 });
    expect(result.latestAnalysisDate).toEqual({ 'sheet-1': '2026-03-15' });
  });
});
