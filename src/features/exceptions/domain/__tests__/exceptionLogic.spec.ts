/**
 * @fileoverview ExceptionLogic の単体テスト
 * @description
 * MVP-006: 例外検出・集約・統計の純粋関数テスト
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateExceptions,
  computeExceptionStats,
  detectAttentionUsers,
  detectCriticalHandoffs,
  detectMissingRecords,
  detectMissingVitals,
} from '../exceptionLogic';

describe('detectMissingRecords', () => {
  it('記録がないユーザーを検出する', () => {
    const result = detectMissingRecords({
      expectedUsers: [
        { userId: 'U-001', userName: '山田太郎' },
        { userId: 'U-002', userName: '佐藤花子' },
      ],
      existingRecords: [
        { userId: 'U-001', userName: '山田太郎', date: '2026-03-17', status: '完了' },
      ],
      targetDate: '2026-03-17',
    });
    expect(result).toHaveLength(1);
    expect(result[0].targetUser).toBe('佐藤花子');
    expect(result[0].category).toBe('missing-record');
    expect(result[0].severity).toBe('high');
  });

  it('全員記録済みなら空配列', () => {
    const result = detectMissingRecords({
      expectedUsers: [{ userId: 'U-001', userName: '山田太郎' }],
      existingRecords: [
        { userId: 'U-001', userName: '山田太郎', date: '2026-03-17', status: '作成中' },
      ],
      targetDate: '2026-03-17',
    });
    expect(result).toHaveLength(0);
  });

  it('別日の記録は検出に含めない', () => {
    const result = detectMissingRecords({
      expectedUsers: [{ userId: 'U-001', userName: '山田太郎' }],
      existingRecords: [
        { userId: 'U-001', userName: '山田太郎', date: '2026-03-16', status: '完了' },
      ],
      targetDate: '2026-03-17',
    });
    expect(result).toHaveLength(1);
  });

  it('対象ユーザーが空なら空配列', () => {
    const result = detectMissingRecords({
      expectedUsers: [],
      existingRecords: [],
      targetDate: '2026-03-17',
    });
    expect(result).toHaveLength(0);
  });
});

describe('detectMissingVitals', () => {
  it('バイタル未計測のユーザーを検出する', () => {
    const result = detectMissingVitals({
      expectedUsers: [
        { userId: 'U-001', userName: '山田太郎' },
        { userId: 'U-002', userName: '佐藤花子' },
      ],
      existingVitals: [
        { userId: 'U-001' },
      ],
      targetDate: '2026-03-17',
    });
    expect(result).toHaveLength(1);
    expect(result[0].targetUser).toBe('佐藤花子');
    expect(result[0].category).toBe('missing-vital');
    expect(result[0].actionPath).toContain('/nurse/observation');
  });

  it('全員計測済みなら空配列', () => {
    const result = detectMissingVitals({
      expectedUsers: [{ userId: 'U-001', userName: '山田太郎' }],
      existingVitals: [{ userId: 'U-001' }],
      targetDate: '2026-03-17',
    });
    expect(result).toHaveLength(0);
  });
});

describe('detectCriticalHandoffs', () => {
  it('重要+未完了の申し送りを検出する', () => {
    const result = detectCriticalHandoffs([
      { id: '1', message: '体調不良', severity: '重要', status: '未対応', createdAt: '2026-03-17' },
      { id: '2', message: 'ok', severity: '通常', status: '未対応', createdAt: '2026-03-17' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('critical-handoff');
    expect(result[0].severity).toBe('critical');
  });

  it('完了済みの重要申し送りは除外する', () => {
    const result = detectCriticalHandoffs([
      { id: '1', message: '体調不良', severity: '重要', status: '完了', createdAt: '2026-03-17' },
      { id: '2', message: '確認した', severity: '重要', status: '確認済', createdAt: '2026-03-17' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('空配列なら空', () => {
    expect(detectCriticalHandoffs([])).toHaveLength(0);
  });
});

describe('detectAttentionUsers', () => {
  it('強度行動障害対象で計画未作成を検出', () => {
    const result = detectAttentionUsers([
      { userId: 'U-001', userName: '山田太郎', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('attention-user');
    expect(result[0].severity).toBe('high');
  });

  it('計画ありなら検出しない', () => {
    const result = detectAttentionUsers([
      { userId: 'U-001', userName: '山田太郎', isHighIntensity: true, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: true },
    ]);
    expect(result).toHaveLength(0);
  });

  it('通常支援なら検出しない', () => {
    const result = detectAttentionUsers([
      { userId: 'U-001', userName: '山田太郎', isHighIntensity: false, isSupportProcedureTarget: false, isTransportTarget: false, hasPlan: false },
    ]);
    expect(result).toHaveLength(0);
  });
});

describe('aggregateExceptions', () => {
  it('severity でソートする (critical → low)', () => {
    const result = aggregateExceptions(
      [{ id: 'a', category: 'missing-record', severity: 'low', title: '', description: '', updatedAt: '' }],
      [{ id: 'b', category: 'critical-handoff', severity: 'critical', title: '', description: '', updatedAt: '' }],
      [{ id: 'c', category: 'attention-user', severity: 'high', title: '', description: '', updatedAt: '' }],
    );
    expect(result.map((r) => r.severity)).toEqual(['critical', 'high', 'low']);
  });

  it('空グループを含めても動作する', () => {
    const result = aggregateExceptions([], [], []);
    expect(result).toHaveLength(0);
  });
});

describe('computeExceptionStats', () => {
  it('正しく集計する', () => {
    const items = [
      { id: 'a', category: 'missing-record' as const, severity: 'high' as const, title: '', description: '', updatedAt: '' },
      { id: 'b', category: 'missing-record' as const, severity: 'high' as const, title: '', description: '', updatedAt: '' },
      { id: 'c', category: 'critical-handoff' as const, severity: 'critical' as const, title: '', description: '', updatedAt: '' },
    ];
    const stats = computeExceptionStats(items);
    expect(stats.total).toBe(3);
    expect(stats.byCategory['missing-record']).toBe(2);
    expect(stats.byCategory['critical-handoff']).toBe(1);
    expect(stats.bySeverity.critical).toBe(1);
    expect(stats.bySeverity.high).toBe(2);
  });

  it('空配列でゼロ初期化', () => {
    const stats = computeExceptionStats([]);
    expect(stats.total).toBe(0);
    expect(stats.bySeverity.critical).toBe(0);
    expect(stats.byCategory['missing-record']).toBe(0);
  });
});
