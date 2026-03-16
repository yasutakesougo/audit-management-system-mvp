/**
 * compareAbcPatternPeriods.spec.ts — ABC パターン時系列比較のユニットテスト
 */
import { describe, expect, it } from 'vitest';
import { compareAbcPatternPeriods } from '../compareAbcPatternPeriods';
import type { AbcRecord } from '../../../../domain/abc/abcRecord';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

let nextId = 1;
function makeRecord(overrides?: Partial<AbcRecord>): AbcRecord {
  const id = String(nextId++);
  return {
    id,
    userId: 'U001',
    userName: '田中太郎',
    occurredAt: '2026-03-15T10:00:00Z',
    setting: '食事場面',
    antecedent: '他利用者が隣に座った',
    behavior: '声を上げる',
    consequence: '職員が声をかけた',
    intensity: 'medium',
    durationMinutes: 5,
    riskFlag: false,
    recorderName: '鈴木',
    tags: [],
    notes: '',
    createdAt: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('compareAbcPatternPeriods', () => {
  describe('基本的な比較', () => {
    it('前期・今期ともに空 → 変化なし', () => {
      const result = compareAbcPatternPeriods([], []);
      expect(result.previousCount).toBe(0);
      expect(result.currentCount).toBe(0);
      expect(result.overallChangeLevel).toBe('none');
      expect(result.alerts).toHaveLength(0);
    });

    it('前期のみ → 全場面 disappeared', () => {
      const prev = [makeRecord({ setting: '食事場面' }), makeRecord({ setting: '食事場面' })];
      const result = compareAbcPatternPeriods(prev, []);
      expect(result.disappearedSettings).toContain('食事場面');
      expect(result.settingChanges.some(c => c.changeType === 'disappeared')).toBe(true);
    });

    it('今期のみ → 全場面 new', () => {
      const curr = [
        makeRecord({ setting: '移動場面' }),
        makeRecord({ setting: '移動場面' }),
        makeRecord({ setting: '移動場面' }),
      ];
      const result = compareAbcPatternPeriods([], curr);
      expect(result.newSettings).toContain('移動場面');
    });
  });

  describe('場面パターン変化検出', () => {
    it('新しい場面が3回以上出現 → new_scene アラート', () => {
      const prev = [makeRecord({ setting: '食事場面' })];
      const curr = [
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '入浴場面' }),
        makeRecord({ setting: '入浴場面' }),
        makeRecord({ setting: '入浴場面' }),
      ];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.newSettings).toContain('入浴場面');
      expect(result.alerts.some(a => a.type === 'new_scene' && a.setting === '入浴場面')).toBe(true);
    });

    it('場面の急増（100%以上） → scene_spike アラート', () => {
      const prev = [makeRecord({ setting: '食事場面' }), makeRecord({ setting: '食事場面' })];
      const curr = [
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
      ];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.alerts.some(a => a.type === 'scene_spike' && a.setting === '食事場面')).toBe(true);
    });

    it('場面の消失 → scene_disappeared アラート（info）', () => {
      const prev = [
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '移動場面' }),
      ];
      const curr = [makeRecord({ setting: '食事場面' })];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.disappearedSettings).toContain('移動場面');
      expect(result.alerts.some(a => a.type === 'scene_disappeared' && a.severity === 'info')).toBe(true);
    });

    it('安定した場面 → stable', () => {
      const prev = [
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
      ];
      const curr = [
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
      ];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.settingChanges[0].changeType).toBe('stable');
    });
  });

  describe('強度分布の変化', () => {
    it('high 割合が増加 → intensity_worsening', () => {
      const prev = [
        makeRecord({ intensity: 'low' }),
        makeRecord({ intensity: 'low' }),
        makeRecord({ intensity: 'medium' }),
      ];
      const curr = [
        makeRecord({ intensity: 'high' }),
        makeRecord({ intensity: 'high' }),
        makeRecord({ intensity: 'medium' }),
      ];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.intensityShift.worsening).toBe(true);
      expect(result.alerts.some(a => a.type === 'intensity_worsening')).toBe(true);
    });

    it('risk フラグ増加 → worsening', () => {
      const prev = [
        makeRecord({ riskFlag: false }),
        makeRecord({ riskFlag: false }),
      ];
      const curr = [
        makeRecord({ riskFlag: true }),
        makeRecord({ riskFlag: true }),
      ];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.intensityShift.riskRateDelta).toBeGreaterThan(0);
      expect(result.intensityShift.worsening).toBe(true);
    });

    it('low のみ→ low のみ → worsening = false', () => {
      const prev = [makeRecord({ intensity: 'low' })];
      const curr = [makeRecord({ intensity: 'low' })];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.intensityShift.worsening).toBe(false);
    });
  });

  describe('overallChangeLevel', () => {
    it('アラートがない安定 → none', () => {
      const prev = [makeRecord({ setting: 'A' })];
      const curr = [makeRecord({ setting: 'A' })];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.overallChangeLevel).toBe('none');
    });

    it('severity=alert あり → significant', () => {
      const prev = [makeRecord({ setting: 'A' })];
      const curr = [
        makeRecord({ setting: 'A' }), makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }), makeRecord({ setting: 'A' }),
      ];
      const result = compareAbcPatternPeriods(prev, curr);
      expect(result.overallChangeLevel).toBe('significant');
    });
  });

  describe('アラートの severity ソート', () => {
    it('alert が warning/info より先に来る', () => {
      const prev = [
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '移動場面' }),
      ];
      const curr = [
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: '食事場面' }),
        makeRecord({ setting: 'NEW場面' }),
        makeRecord({ setting: 'NEW場面' }),
        makeRecord({ setting: 'NEW場面' }),
      ];
      const result = compareAbcPatternPeriods(prev, curr);
      if (result.alerts.length >= 2) {
        const severities = result.alerts.map(a => a.severity);
        const alertIdx = severities.indexOf('alert');
        const infoIdx = severities.indexOf('info');
        if (alertIdx >= 0 && infoIdx >= 0) {
          expect(alertIdx).toBeLessThan(infoIdx);
        }
      }
    });
  });

  describe('カスタム閾値', () => {
    it('changeRateThreshold を 0.2 に設定 → より多くの変化を検出', () => {
      const prev = [
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
      ];
      const curr = [
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
        makeRecord({ setting: 'A' }),
      ];
      const strict = compareAbcPatternPeriods(prev, curr, { changeRateThreshold: 0.2 });
      const loose = compareAbcPatternPeriods(prev, curr, { changeRateThreshold: 0.8 });
      expect(strict.significantIncreases.length).toBeGreaterThanOrEqual(loose.significantIncreases.length);
    });
  });

  describe('suggestion 文', () => {
    it('各アラートに suggestion がある', () => {
      const prev = [makeRecord({ setting: '食事' })];
      const curr = [
        makeRecord({ setting: '入浴' }),
        makeRecord({ setting: '入浴' }),
        makeRecord({ setting: '入浴' }),
      ];
      const result = compareAbcPatternPeriods(prev, curr);
      for (const alert of result.alerts) {
        expect(alert.suggestion.length).toBeGreaterThan(0);
      }
    });
  });
});
