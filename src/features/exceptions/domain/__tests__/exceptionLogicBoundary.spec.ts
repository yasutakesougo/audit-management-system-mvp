/**
 * Contract Tests: exceptionLogic — detect 系境界値補完
 *
 * 既存の exceptionLogic.spec.ts (MVP-006) に対して、
 * 未カバーの境界値・出力フィールド・複合ケースを追加固定する。
 *
 * ## 追加する観点
 *
 * ### detectMissingRecords
 * - id 形式: `missing-{userId}-{date}` を固定
 * - actionPath: `/daily/activity?userId=...` にエンコードされること
 * - 複数ユーザー全員未入力
 * - 既存記録は targetDate 以外なら無視される
 * - ExceptionItem の必須フィールドが揃っていること
 *
 * ### detectCriticalHandoffs
 * - message が60文字超 → 60文字+… に截断
 * - message が60文字以内 → そのまま
 * - userName / userId が ExceptionItem に伝播
 * - actionPath が固定 `/handoff/timeline`
 * - id 形式: `handoff-{id}` を固定
 *
 * ### detectAttentionUsers
 * - 強度行動障害 + 計画なし: 複数ユーザー → 複数件
 * - 強度行動障害 + 計画なし + 強度行動障害なし: 混在
 * - id 形式: `attention-{userId}-no-plan` を固定
 * - actionPath: `/isp-editor/{encodedUserId}`
 *
 * ### aggregateExceptions
 * - 同 severity 時は category のアルファベット順
 * - 1グループのみ渡した場合も動作
 * - 合計件数が正しい
 *
 * ### computeExceptionStats
 * - medium / low severity が正しくカウント
 * - 全カテゴリが 0 でも正しい初期状態
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateExceptions,
  computeExceptionStats,
  detectAttentionUsers,
  detectCriticalHandoffs,
  detectMissingRecords,
} from '../exceptionLogic';

// ─── detectMissingRecords 補完 ────────────────────────────────

describe('detectMissingRecords — 境界値補完', () => {
  it('should format id as missing-{userId}-{targetDate}', () => {
    const result = detectMissingRecords({
      expectedUsers: [{ userId: 'U-001', userName: '山田太郎' }],
      existingRecords: [],
      targetDate: '2026-03-18',
    });
    expect(result[0].id).toBe('missing-U-001-2026-03-18');
  });

  it('should set actionPath to /daily/activity?userId={encodedUserId}', () => {
    const result = detectMissingRecords({
      expectedUsers: [{ userId: 'U-001', userName: '山田太郎' }],
      existingRecords: [],
      targetDate: '2026-03-18',
    });
    expect(result[0].actionPath).toBe('/daily/activity?userId=U-001');
  });

  it('should encode special characters in userId for actionPath', () => {
    const result = detectMissingRecords({
      expectedUsers: [{ userId: 'U 001', userName: 'テスト利用者' }],
      existingRecords: [],
      targetDate: '2026-03-18',
    });
    expect(result[0].actionPath).toContain(encodeURIComponent('U 001'));
  });

  it('should detect all users when no records exist', () => {
    const result = detectMissingRecords({
      expectedUsers: [
        { userId: 'U-001', userName: 'A' },
        { userId: 'U-002', userName: 'B' },
        { userId: 'U-003', userName: 'C' },
      ],
      existingRecords: [],
      targetDate: '2026-03-18',
    });
    expect(result).toHaveLength(3);
  });

  it('should ignore records from other dates', () => {
    const result = detectMissingRecords({
      expectedUsers: [{ userId: 'U-001', userName: '山田' }],
      existingRecords: [
        { userId: 'U-001', userName: '山田', date: '2026-03-17', status: '完了' },
        { userId: 'U-001', userName: '山田', date: '2026-03-19', status: '完了' },
      ],
      targetDate: '2026-03-18',
    });
    expect(result).toHaveLength(1); // 当日の記録がないので検出
  });

  it('should include required ExceptionItem fields', () => {
    const result = detectMissingRecords({
      expectedUsers: [{ userId: 'U-001', userName: '山田太郎' }],
      existingRecords: [],
      targetDate: '2026-03-18',
    });
    const item = result[0];
    expect(item.category).toBe('missing-record');
    expect(item.severity).toBe('high');
    expect(item.title).toBeTruthy();
    expect(item.description).toBeTruthy();
    expect(item.targetUser).toBe('山田太郎');
    expect(item.targetUserId).toBe('U-001');
    expect(item.targetDate).toBe('2026-03-18');
    expect(item.updatedAt).toBe('2026-03-18');
    expect(item.actionLabel).toBe('日々の記録');
  });
});

// ─── detectCriticalHandoffs 補完 ─────────────────────────────

describe('detectCriticalHandoffs — 境界値補完', () => {
  it('should format id as handoff-{id}', () => {
    const result = detectCriticalHandoffs([
      { id: 'HO-42', message: '緊急連絡', severity: '重要', status: '未対応', createdAt: '2026-03-18' },
    ]);
    expect(result[0].id).toBe('handoff-HO-42');
  });

  it('should truncate message to 60 chars + … when over 60', () => {
    const longMsg = 'あ'.repeat(65);
    const result = detectCriticalHandoffs([
      { id: '1', message: longMsg, severity: '重要', status: '未対応', createdAt: '2026-03-18' },
    ]);
    expect(result[0].description).toBe('あ'.repeat(60) + '…');
    expect(result[0].description.length).toBe(61);
  });

  it('should keep message as-is when 60 chars or fewer', () => {
    const exactMsg = 'あ'.repeat(60);
    const result = detectCriticalHandoffs([
      { id: '1', message: exactMsg, severity: '重要', status: '未対応', createdAt: '2026-03-18' },
    ]);
    expect(result[0].description).toBe(exactMsg);
  });

  it('should propagate userName and userId to ExceptionItem', () => {
    const result = detectCriticalHandoffs([
      {
        id: '1',
        message: '緊急',
        severity: '重要',
        status: '未対応',
        createdAt: '2026-03-18',
        userName: '田中太郎',
        userId: 'U-005',
      },
    ]);
    expect(result[0].targetUser).toBe('田中太郎');
    expect(result[0].targetUserId).toBe('U-005');
  });

  it('should set actionPath to /handoff/timeline', () => {
    const result = detectCriticalHandoffs([
      { id: '1', message: '確認', severity: '重要', status: '未対応', createdAt: '2026-03-18' },
    ]);
    expect(result[0].actionPath).toBe('/handoff/timeline?date=2026-03-18&handoffId=1');
  });

  it('should set severity to critical regardless of input severity label', () => {
    const result = detectCriticalHandoffs([
      { id: '1', message: '確認', severity: '重要', status: '未対応', createdAt: '2026-03-18' },
    ]);
    expect(result[0].severity).toBe('critical');
    expect(result[0].category).toBe('critical-handoff');
  });

  it('should detect multiple unresolved handoffs', () => {
    const result = detectCriticalHandoffs([
      { id: '1', message: 'A', severity: '重要', status: '未対応', createdAt: '2026-03-18' },
      { id: '2', message: 'B', severity: '重要', status: '保留', createdAt: '2026-03-18' },
      { id: '3', message: 'C', severity: '重要', status: '確認済', createdAt: '2026-03-18' },
    ]);
    // 確認済は除外、未対応+保留は残る
    expect(result).toHaveLength(2);
  });
});

// ─── detectAttentionUsers 補完 ────────────────────────────────

describe('detectAttentionUsers — 境界値補完', () => {
  it('should format id as attention-{userId}-no-plan', () => {
    const result = detectAttentionUsers([
      { userId: 'U-010', userName: 'テスト', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
    ]);
    expect(result[0].id).toBe('attention-U-010-no-plan');
  });

  it('should set actionPath to /isp-editor/{encodedUserId}', () => {
    const result = detectAttentionUsers([
      { userId: 'U-010', userName: 'テスト', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
    ]);
    expect(result[0].actionPath).toBe(`/isp-editor/${encodeURIComponent('U-010')}`);
  });

  it('should detect multiple high-intensity users without plans', () => {
    const result = detectAttentionUsers([
      { userId: 'U-001', userName: 'A', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
      { userId: 'U-002', userName: 'B', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
    ]);
    expect(result).toHaveLength(2);
  });

  it('should filter correctly in mixed user list', () => {
    const result = detectAttentionUsers([
      { userId: 'U-001', userName: 'A', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
      { userId: 'U-002', userName: 'B', isHighIntensity: false, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
      { userId: 'U-003', userName: 'C', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: true },
    ]);
    // U-001 のみ検出
    expect(result).toHaveLength(1);
    expect(result[0].targetUserId).toBe('U-001');
  });

  it('should return empty array when all users have plans', () => {
    const result = detectAttentionUsers([
      { userId: 'U-001', userName: 'A', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: true },
      { userId: 'U-002', userName: 'B', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: true },
    ]);
    expect(result).toHaveLength(0);
  });

  it('should return empty array for empty input', () => {
    expect(detectAttentionUsers([])).toHaveLength(0);
  });

  it('should include required fields in result', () => {
    const result = detectAttentionUsers([
      { userId: 'U-010', userName: '田中', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
    ]);
    const item = result[0];
    expect(item.category).toBe('attention-user');
    expect(item.severity).toBe('high');
    expect(item.targetUser).toBe('田中');
    expect(item.targetUserId).toBe('U-010');
    expect(item.title).toContain('田中');
    expect(item.actionLabel).toBe('計画を作成');
  });
});

// ─── aggregateExceptions 補完 ────────────────────────────────

describe('aggregateExceptions — 境界値補完', () => {
  const makeItem = (id: string, severity: 'critical' | 'high' | 'medium' | 'low', category: 'missing-record' | 'overdue-plan' | 'critical-handoff' | 'attention-user') => ({
    id,
    category,
    severity,
    title: '',
    description: '',
    updatedAt: '',
  });

  it('should sort by category alphabetically when severity is equal', () => {
    const result = aggregateExceptions([
      makeItem('c', 'high', 'overdue-plan'),
      makeItem('a', 'high', 'attention-user'),
      makeItem('b', 'high', 'missing-record'),
    ]);
    expect(result.map((r) => r.category)).toEqual([
      'attention-user',
      'missing-record',
      'overdue-plan',
    ]);
  });

  it('should work with a single group', () => {
    const result = aggregateExceptions([
      makeItem('a', 'critical', 'critical-handoff'),
      makeItem('b', 'high', 'missing-record'),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].severity).toBe('critical');
  });

  it('should return correct total count across groups', () => {
    const result = aggregateExceptions(
      [makeItem('a', 'high', 'missing-record'), makeItem('b', 'high', 'missing-record')],
      [makeItem('c', 'critical', 'critical-handoff')],
    );
    expect(result).toHaveLength(3);
  });

  it('should place medium and low after high', () => {
    const result = aggregateExceptions([
      makeItem('a', 'medium', 'missing-record'),
      makeItem('b', 'high', 'missing-record'),
      makeItem('c', 'low', 'missing-record'),
    ]);
    expect(result.map((r) => r.severity)).toEqual(['high', 'medium', 'low']);
  });
});

// ─── computeExceptionStats 補完 ──────────────────────────────

describe('computeExceptionStats — 境界値補完', () => {
  it('should count medium and low severity correctly', () => {
    const items = [
      { id: 'a', category: 'missing-record' as const, severity: 'medium' as const, title: '', description: '', updatedAt: '' },
      { id: 'b', category: 'overdue-plan' as const, severity: 'low' as const, title: '', description: '', updatedAt: '' },
    ];
    const stats = computeExceptionStats(items);
    expect(stats.bySeverity.medium).toBe(1);
    expect(stats.bySeverity.low).toBe(1);
    expect(stats.bySeverity.high).toBe(0);
    expect(stats.bySeverity.critical).toBe(0);
  });

  it('should count all four categories independently', () => {
    const items = [
      { id: 'a', category: 'missing-record' as const, severity: 'high' as const, title: '', description: '', updatedAt: '' },
      { id: 'b', category: 'overdue-plan' as const, severity: 'high' as const, title: '', description: '', updatedAt: '' },
      { id: 'c', category: 'critical-handoff' as const, severity: 'critical' as const, title: '', description: '', updatedAt: '' },
      { id: 'd', category: 'attention-user' as const, severity: 'high' as const, title: '', description: '', updatedAt: '' },
    ];
    const stats = computeExceptionStats(items);
    expect(stats.byCategory['missing-record']).toBe(1);
    expect(stats.byCategory['overdue-plan']).toBe(1);
    expect(stats.byCategory['critical-handoff']).toBe(1);
    expect(stats.byCategory['attention-user']).toBe(1);
    expect(stats.total).toBe(4);
  });
});
