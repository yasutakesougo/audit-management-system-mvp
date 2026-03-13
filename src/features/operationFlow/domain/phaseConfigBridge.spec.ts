/**
 * phaseConfigBridge — ユニットテスト
 *
 * 検証ポイント:
 *   - 9分割キー → 旧6分割マッピングの正確性
 *   - 設定値ベース判定で旧互換結果が返ること
 *   - 設定穴（どのフェーズにも該当しない時刻）でレガシーフォールバックが動くこと
 *   - /daily/attendance → /daily 変換
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PHASE_CONFIG } from './defaultPhaseConfig';
import type { OperationFlowPhaseConfig } from './operationFlowTypes';
import {
  resolvePhaseFromConfig,
  toLegacyPhase,
  toLegacyPrimaryScreen,
} from './phaseConfigBridge';

// ────────────────────────────────────────
// toLegacyPhase
// ────────────────────────────────────────

describe('toLegacyPhase', () => {
  it.each([
    ['staff_prep', 'preparation'],
    ['morning_briefing', 'morning-meeting'],
    ['arrival_intake', 'am-operation'],
    ['am_activity', 'am-operation'],
    ['pm_activity', 'pm-operation'],
    ['departure_support', 'evening-closing'],
    ['record_wrapup', 'record-review'],
    ['evening_briefing', 'record-review'],
    ['after_hours_review', 'record-review'],
  ] as const)('%s → %s', (key, expected) => {
    expect(toLegacyPhase(key)).toBe(expected);
  });
});

// ────────────────────────────────────────
// toLegacyPrimaryScreen
// ────────────────────────────────────────

describe('toLegacyPrimaryScreen', () => {
  it('/daily/attendance → /daily', () => {
    expect(toLegacyPrimaryScreen('/daily/attendance')).toBe('/daily');
  });

  it('/today → /today (パススルー)', () => {
    expect(toLegacyPrimaryScreen('/today')).toBe('/today');
  });

  it('/handoff-timeline → /handoff-timeline (パススルー)', () => {
    expect(toLegacyPrimaryScreen('/handoff-timeline')).toBe('/handoff-timeline');
  });

  it('/dashboard → /dashboard (パススルー)', () => {
    expect(toLegacyPrimaryScreen('/dashboard')).toBe('/dashboard');
  });

  it('/daily → /daily (パススルー)', () => {
    expect(toLegacyPrimaryScreen('/daily')).toBe('/daily');
  });
});

// ────────────────────────────────────────
// resolvePhaseFromConfig
// ────────────────────────────────────────

describe('resolvePhaseFromConfig', () => {
  describe('DEFAULT_PHASE_CONFIG での判定', () => {
    it('08:45 → staff_prep → preparation (fromConfig: true)', () => {
      const now = new Date('2026-03-13T08:45:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('preparation');
      expect(result.fromConfig).toBe(true);
      expect(result.configLabel).toBe('出勤・朝準備');
    });

    it('09:00 → morning_briefing → morning-meeting', () => {
      const now = new Date('2026-03-13T09:00:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('morning-meeting');
      expect(result.legacyPrimaryScreen).toBe('/handoff-timeline');
      expect(result.fromConfig).toBe(true);
    });

    it('09:30 → arrival_intake → am-operation', () => {
      const now = new Date('2026-03-13T09:30:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('am-operation');
      expect(result.configPrimaryScreen).toBe('/daily/attendance');
      expect(result.legacyPrimaryScreen).toBe('/daily');
      expect(result.fromConfig).toBe(true);
    });

    it('11:00 → am_activity → am-operation', () => {
      const now = new Date('2026-03-13T11:00:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('am-operation');
      expect(result.isTodayPrimary).toBe(true);
      expect(result.fromConfig).toBe(true);
    });

    it('13:00 → pm_activity → pm-operation', () => {
      const now = new Date('2026-03-13T13:00:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('pm-operation');
      expect(result.fromConfig).toBe(true);
    });

    it('15:45 → departure_support → evening-closing', () => {
      const now = new Date('2026-03-13T15:45:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('evening-closing');
      expect(result.fromConfig).toBe(true);
    });

    it('16:30 → record_wrapup → record-review', () => {
      const now = new Date('2026-03-13T16:30:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('record-review');
      expect(result.fromConfig).toBe(true);
    });

    it('17:30 → evening_briefing → record-review', () => {
      const now = new Date('2026-03-13T17:30:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('record-review');
      expect(result.legacyPrimaryScreen).toBe('/handoff-timeline');
      expect(result.fromConfig).toBe(true);
    });

    it('23:00 → after_hours_review → record-review (日またぎ)', () => {
      const now = new Date('2026-03-13T23:00:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('record-review');
      expect(result.legacyPrimaryScreen).toBe('/dashboard');
      expect(result.fromConfig).toBe(true);
    });

    it('03:00 → after_hours_review → record-review (深夜)', () => {
      const now = new Date('2026-03-14T03:00:00');
      const result = resolvePhaseFromConfig(now, DEFAULT_PHASE_CONFIG);

      expect(result.operationalPhase).toBe('record-review');
      expect(result.fromConfig).toBe(true);
    });
  });

  describe('カスタム設定での判定', () => {
    it('時間帯を変えるとフェーズが変わる', () => {
      // 朝会を 10:00–10:30 に変更したカスタム設定
      const customConfig = DEFAULT_PHASE_CONFIG.map((c: OperationFlowPhaseConfig) =>
        c.phaseKey === 'morning_briefing'
          ? { ...c, startTime: '10:00', endTime: '10:30' }
          : c,
      );

      // 09:00 は DEFAULT だと morning_briefing だが、カスタムでは arrival_intake
      const now = new Date('2026-03-13T09:15:00');
      const result = resolvePhaseFromConfig(now, customConfig);

      // arrival_intake の時間帯に入る
      expect(result.operationalPhase).toBe('am-operation');
      expect(result.fromConfig).toBe(true);
    });

    it('primaryScreen を変えると結果に反映される', () => {
      const customConfig = DEFAULT_PHASE_CONFIG.map((c: OperationFlowPhaseConfig) =>
        c.phaseKey === 'staff_prep'
          ? { ...c, primaryScreen: '/dashboard' as const }
          : c,
      );

      const now = new Date('2026-03-13T08:45:00');
      const result = resolvePhaseFromConfig(now, customConfig);

      expect(result.configPrimaryScreen).toBe('/dashboard');
      expect(result.legacyPrimaryScreen).toBe('/dashboard');
      expect(result.isTodayPrimary).toBe(false);
    });
  });

  describe('フォールバック', () => {
    it('空の設定配列 → 旧ロジックにフォールバック (fromConfig: false)', () => {
      const now = new Date('2026-03-13T10:00:00');
      const result = resolvePhaseFromConfig(now, []);

      // 旧ロジック: 10:00 は am-operation
      expect(result.operationalPhase).toBe('am-operation');
      expect(result.fromConfig).toBe(false);
    });
  });
});
