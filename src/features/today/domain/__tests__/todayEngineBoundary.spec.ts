/**
 * Contract Tests: today/domain engine 境界値補完
 *
 * 既存テストの未カバー観点を固定:
 *
 * ### calculateUrgency
 * - スコアの具体値（formula: 50 + diffMinutes, overdue: +100）
 * - SLA 境界（ちょうど / 1分前 / 1分後）
 * - slaMinutes なし時の挙動（デフォルト 0）
 * - 大幅な早着時も score >= 0
 * - Math.round の丸め
 *
 * ### scoreActionPriority
 * - 全 sourceType の priority 値固定
 *
 * ### buildTodayActionQueue 統合境界
 * - 空配列 → 空配列
 * - 全件完了済み → 空配列
 * - P0 / P1 / P2 / P3 の全優先度順
 * - ActionCard フィールド完全性
 */
import { describe, expect, it } from 'vitest';
import { calculateUrgency } from '../engine/calculateUrgency';
import { scoreActionPriority } from '../engine/scoreActionPriority';
import { buildTodayActionQueue } from '../engine/buildTodayActionQueue';
import type { RawActionSource } from '../models/queue.types';

// ─── テスト用ヘルパー ─────────────────────────────────────────

function source(overrides: Partial<RawActionSource>): RawActionSource {
  return {
    id: overrides.id ?? 'x',
    sourceType: overrides.sourceType ?? 'schedule',
    title: overrides.title ?? 'title',
    targetTime: overrides.targetTime,
    slaMinutes: overrides.slaMinutes,
    isCompleted: overrides.isCompleted ?? false,
    assignedStaffId: overrides.assignedStaffId,
    payload: overrides.payload ?? {},
  };
}

const BASE_NOW = new Date('2026-03-18T13:00:00');

// ─── calculateUrgency — 具体値境界 ───────────────────────────

describe('calculateUrgency — 具体値・境界補完', () => {
  it('targetTime ちょうどのとき score=50, isOverdue=false (slaMinutes=0)', () => {
    const result = calculateUrgency(BASE_NOW, BASE_NOW, 0);
    // diffMinutes = 0, score = 50+0 = 50, isOverdue = (0 > 0) = false
    expect(result.score).toBe(50);
    expect(result.isOverdue).toBe(false);
  });

  it('targetTime の30分前は score が 0 以上で isOverdue=false', () => {
    const target = new Date('2026-03-18T13:30:00'); // now より30分後 = diff = -30
    const result = calculateUrgency(target, BASE_NOW, 15);
    // diffMinutes = -30, score = max(0, 50 + (-30)) = max(0, 20) = 20
    expect(result.score).toBe(20);
    expect(result.isOverdue).toBe(false);
  });

  it('SLA ちょうど（diff === slaMinutes）は overdue にならない', () => {
    const target = new Date('2026-03-18T12:45:00'); // diff = 15min
    const result = calculateUrgency(target, BASE_NOW, 15);
    // isOverdue = (15 > 15) = false
    expect(result.isOverdue).toBe(false);
  });

  it('SLA 超過1分（diff = slaMinutes + 1）は overdue になる', () => {
    const target = new Date('2026-03-18T12:44:00'); // diff = 16min
    const result = calculateUrgency(target, BASE_NOW, 15);
    // isOverdue = (16 > 15) = true
    expect(result.isOverdue).toBe(true);
  });

  it('SLA 超過時は score が +100 される（50 + diff + 100）', () => {
    const target = new Date('2026-03-18T12:00:00'); // diff = 60min
    const result = calculateUrgency(target, BASE_NOW, 15);
    // isOverdue = (60 > 15) = true, score = 50 + 60 + 100 = 210
    expect(result.score).toBe(210);
    expect(result.isOverdue).toBe(true);
  });

  it('slaMinutes 省略時はデフォルト 0 として扱われ、即過去で overdue', () => {
    const target = new Date('2026-03-18T12:59:00'); // diff = 1min
    const result = calculateUrgency(target, BASE_NOW); // slaMinutes = 0
    // isOverdue = (1 > 0) = true
    expect(result.isOverdue).toBe(true);
  });

  it('targetTime が大幅に未来でも score は 0 以上', () => {
    const target = new Date('2026-03-18T14:00:00'); // diff = -60min
    const result = calculateUrgency(target, BASE_NOW, 15);
    // score = max(0, 50 + (-60)) = max(0, -10) = 0
    expect(result.score).toBe(0);
    expect(result.isOverdue).toBe(false);
  });

  it('score は Math.round で整数になる', () => {
    // diff = 0.5分 (30秒後)
    const target = new Date(BASE_NOW.getTime() - 30 * 1000);
    const result = calculateUrgency(target, BASE_NOW, 15);
    expect(Number.isInteger(result.score)).toBe(true);
  });
});

// ─── scoreActionPriority — 全 sourceType ─────────────────────

describe('scoreActionPriority — 全 sourceType 固定', () => {
  it('vital_alert → P0', () => {
    expect(scoreActionPriority(source({ sourceType: 'vital_alert' }))).toBe('P0');
  });

  it('incident → P1', () => {
    expect(scoreActionPriority(source({ sourceType: 'incident' }))).toBe('P1');
  });

  it('schedule → P2', () => {
    expect(scoreActionPriority(source({ sourceType: 'schedule' }))).toBe('P2');
  });

  it('handoff → P3', () => {
    expect(scoreActionPriority(source({ sourceType: 'handoff' }))).toBe('P3');
  });

  it('isp_renew_suggest → P2', () => {
    expect(scoreActionPriority(source({ sourceType: 'isp_renew_suggest' }))).toBe('P2');
  });
});

// ─── buildTodayActionQueue — 統合境界補完 ─────────────────────

describe('buildTodayActionQueue — 統合境界補完', () => {
  it('空配列を渡すと空配列が返る', () => {
    expect(buildTodayActionQueue([], BASE_NOW)).toEqual([]);
  });

  it('全件完了済みなら空配列が返る', () => {
    const result = buildTodayActionQueue([
      source({ id: 'a', isCompleted: true }),
      source({ id: 'b', isCompleted: true }),
    ], BASE_NOW);
    expect(result).toEqual([]);
  });

  it('P0 > P1 > P2 > P3 の全優先度順が守られる', () => {
    const result = buildTodayActionQueue([
      source({ id: 'handoff-1', sourceType: 'handoff' }),
      source({ id: 'schedule-1', sourceType: 'schedule' }),
      source({ id: 'vital-1', sourceType: 'vital_alert' }),
      source({ id: 'incident-1', sourceType: 'incident' }),
    ], BASE_NOW);

    const ids = result.map((r) => r.id);
    expect(ids[0]).toBe('vital-1');    // P0
    expect(ids[1]).toBe('incident-1'); // P1
    expect(ids[2]).toBe('schedule-1'); // P2
    expect(ids[3]).toBe('handoff-1');  // P3
  });

  it('ActionCard に id / title / priority / isOverdue が含まれる', () => {
    const result = buildTodayActionQueue([
      source({ id: 'test-1', title: 'テストタスク', sourceType: 'schedule' }),
    ], BASE_NOW);
    const card = result[0];
    expect(card).toHaveProperty('id', 'test-1');
    expect(card).toHaveProperty('title', 'テストタスク');
    expect(card).toHaveProperty('priority');
    expect(card).toHaveProperty('isOverdue');
  });

  it('targetTime なし + isCompleted=false → リストに残る', () => {
    const result = buildTodayActionQueue([
      source({ id: 'no-time', sourceType: 'handoff', targetTime: undefined }),
    ], BASE_NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('no-time');
  });

  it('isp_renew_suggest は recommendation-only の文脈で NAVIGATE カードになる', () => {
    const result = buildTodayActionQueue([
      source({
        id: 'isp-1',
        sourceType: 'isp_renew_suggest',
        title: '利用者 U001 の ISP見直しを推奨',
        payload: {
          reason: '支援方法の見直しが必要',
          impact: 'high',
          recommendedOnly: true,
          path: '/support-plan-guide?userId=U001&tab=operations.monitoring',
        },
      }),
    ], BASE_NOW);

    expect(result).toHaveLength(1);
    expect(result[0].actionType).toBe('NAVIGATE');
    expect(result[0].priority).toBe('P2');
    expect(result[0].contextMessage).toContain('自動適用なし');
  });
});
