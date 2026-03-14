/**
 * buildLastReassessmentMap — 純粋関数の単体テスト
 *
 * SharePoint 依存ゼロ。OOM リスクなし。
 */
import { describe, it, expect } from 'vitest';
import {
  buildLastReassessmentMap,
  type SheetWithReviewedAt,
} from '@/domain/regulatory/reassessmentMapBuilder';

// 最小限の SheetWithReviewedAt ファクトリ
const makeSheet = (reviewedAt: string | null, id = 'sp-1'): SheetWithReviewedAt => ({
  id,
  reviewedAt,
});

describe('buildLastReassessmentMap', () => {

  it('空マップには空を返す', () => {
    const result = buildLastReassessmentMap(new Map());
    expect(result.size).toBe(0);
  });

  it('複数シートの最新 reviewedAt を採用する', () => {
    const sheetsByUser = new Map<string, SheetWithReviewedAt[]>();
    sheetsByUser.set('U001', [
      makeSheet('2025-06-01'),
      makeSheet('2025-09-15'),
      makeSheet('2025-03-10'),
    ]);

    const result = buildLastReassessmentMap(sheetsByUser);
    expect(result.get('U001')).toBe('2025-09-15');
  });

  it('reviewedAt が全て null の場合 null を返す', () => {
    const sheetsByUser = new Map<string, SheetWithReviewedAt[]>();
    sheetsByUser.set('U001', [
      makeSheet(null),
      makeSheet(null),
    ]);

    const result = buildLastReassessmentMap(sheetsByUser);
    expect(result.get('U001')).toBeNull();
  });

  it('複数利用者を個別に処理する', () => {
    const sheetsByUser = new Map<string, SheetWithReviewedAt[]>();
    sheetsByUser.set('U001', [makeSheet('2025-12-01')]);
    sheetsByUser.set('U002', [makeSheet('2026-01-01')]);
    sheetsByUser.set('U003', [makeSheet(null)]);

    const result = buildLastReassessmentMap(sheetsByUser);
    expect(result.get('U001')).toBe('2025-12-01');
    expect(result.get('U002')).toBe('2026-01-01');
    expect(result.get('U003')).toBeNull();
  });

  it('一部 null 混在の場合、null 以外の最新を返す', () => {
    const sheetsByUser = new Map<string, SheetWithReviewedAt[]>();
    sheetsByUser.set('U001', [
      makeSheet(null),
      makeSheet('2025-08-01'),
      makeSheet(null),
    ]);

    const result = buildLastReassessmentMap(sheetsByUser);
    expect(result.get('U001')).toBe('2025-08-01');
  });

  it('シートが空配列の場合 null を返す', () => {
    const sheetsByUser = new Map<string, SheetWithReviewedAt[]>();
    sheetsByUser.set('U001', []);

    const result = buildLastReassessmentMap(sheetsByUser);
    expect(result.get('U001')).toBeNull();
  });
});
