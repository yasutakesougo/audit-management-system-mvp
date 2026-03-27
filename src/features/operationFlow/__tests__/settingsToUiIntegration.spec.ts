/**
 * 統合テスト: 設定変更が /today /daily のUIバナーに反映されるかの検証
 *
 * テストシナリオ:
 *   1. Repository にカスタム設定を保存 → TodayPhaseIndicator が反映
 *   2. Repository にカスタム設定を保存 → DailyPhaseHintBanner が反映
 *   3. resetToDefault → 元の判定に戻る
 *   4. Repository 読み込み失敗 → DEFAULT_PHASE_CONFIG にフォールバック
 *
 * 検証ポイント:
 *   - 設定画面で朝会終了時刻を変えると、/today の判定フェーズが変わる
 *   - DailyPhaseHintBanner も同様に設定値を反映する
 *   - フォールバック時に画面が壊れない
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createOperationalPhaseRepository,
  __resetRepositoryForTesting,
} from '@/features/operationFlow/data/createOperationalPhaseRepository';
import { DEFAULT_PHASE_CONFIG } from '@/features/operationFlow/domain/defaultPhaseConfig';
import type { OperationFlowPhaseConfig } from '@/features/operationFlow/domain/operationFlowTypes';
import { getDailyPhaseHint } from '@/features/daily/components/sections/DailyPhaseHintBanner';
import { getTodayPhaseHint } from '@/features/today/widgets/TodayPhaseIndicator';

// ────────────────────────────────────────
// テストヘルパー
// ────────────────────────────────────────

/** HH:mm の簡易 Date 生成 */
function dateAt(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date('2026-03-13T00:00:00');
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * 朝会終了時刻を変更したカスタム設定を作る
 *
 * デフォルト: morning_briefing 09:00–09:15
 * カスタム:   morning_briefing 09:00–10:00 (終了を遅らせる)
 */
function makeCustomConfig(
  overrides: Partial<Record<string, Partial<OperationFlowPhaseConfig>>>,
): OperationFlowPhaseConfig[] {
  return DEFAULT_PHASE_CONFIG.map((c: OperationFlowPhaseConfig) => {
    const override = overrides[c.phaseKey];
    return override ? { ...c, ...override } : { ...c };
  });
}

// ────────────────────────────────────────
// テスト
// ────────────────────────────────────────

describe('設定 → UI反映: 純粋関数レイヤーの統合テスト', () => {
  beforeEach(() => {
    __resetRepositoryForTesting();
  });

  afterEach(() => {
    __resetRepositoryForTesting();
  });

  // ────────────────────────────────────────
  // Scenario 1: 朝会終了時刻を変えると TodayPhaseIndicator が反映
  // ────────────────────────────────────────

  describe('TodayPhaseIndicator: 設定変更の反映', () => {
    it('DEFAULT: 09:20 → am-operation (通所受入)', () => {
      const hint = getTodayPhaseHint(dateAt('09:20'));
      expect(hint.phase).toBe('am-operation');
    });

    it('カスタム: 朝会を10:00まで延長 → 09:20が morning-meeting になる', () => {
      const custom = makeCustomConfig({
        morning_briefing: { endTime: '10:00' },
        arrival_intake: { startTime: '10:00' }, // 通所受入も調整
      });

      const hint = getTodayPhaseHint(dateAt('09:20'), custom);
      expect(hint.phase).toBe('morning-meeting');
      expect(hint.label).toBe('朝会');
    });

    it('カスタム: 午前活動の開始を遅らせると09:30がまだ通所受入', () => {
      const custom = makeCustomConfig({
        arrival_intake: { endTime: '10:30' },
        am_activity: { startTime: '10:30' },
      });

      const hint = getTodayPhaseHint(dateAt('09:30'), custom);
      // 09:30 が arrival_intake の時間帯に含まれるはず
      expect(hint.phase).toBe('am-operation'); // arrival_intake → am-operation
    });

    it('カスタム: primaryScreen を変えると hint に反映', () => {
      const custom = makeCustomConfig({
        am_activity: { primaryScreen: '/dashboard' },
      });

      const hint = getTodayPhaseHint(dateAt('11:00'), custom);
      expect(hint.primaryScreen).toBe('/dashboard');
      expect(hint.isTodayPrimary).toBe(false);
    });
  });

  // ────────────────────────────────────────
  // Scenario 2: DailyPhaseHintBanner: 設定変更の反映
  // ────────────────────────────────────────

  describe('DailyPhaseHintBanner: 設定変更の反映', () => {
    it('DEFAULT: 09:00 → morning-meeting', () => {
      const hint = getDailyPhaseHint(dateAt('09:00'));
      expect(hint.phase).toBe('morning-meeting');
    });

    it('カスタム: 朝会を8:45–8:55に短縮 → 09:00が arrival_intake (am-operation) になる', () => {
      const custom = makeCustomConfig({
        morning_briefing: { startTime: '08:45', endTime: '08:55' },
        arrival_intake: { startTime: '08:55' },
      });

      const hint = getDailyPhaseHint(dateAt('09:00'), custom);
      expect(hint.phase).toBe('am-operation');
    });

    it('カスタム: 退所対応の時間帯を前倒し → 15:00が evening-closing', () => {
      const custom = makeCustomConfig({
        pm_activity: { endTime: '15:00' },
        departure_support: { startTime: '15:00' },
      });

      const hint = getDailyPhaseHint(dateAt('15:00'), custom);
      expect(hint.phase).toBe('evening-closing');
    });
  });

  // ────────────────────────────────────────
  // Scenario 3: 初期値リセット
  // ────────────────────────────────────────

  describe('初期値リセット', () => {
    it('Repository で saveAll → resetToDefault → getAll が DEFAULT_PHASE_CONFIG に戻る', async () => {
      const repo = createOperationalPhaseRepository();

      // カスタム保存
      const custom = makeCustomConfig({
        morning_briefing: { endTime: '10:00' },
      });
      await repo.saveAll(custom);

      let stored = await repo.getAll();
      const briefing = stored.find((c) => c.phaseKey === 'morning_briefing');
      expect(briefing?.endTime).toBe('10:00');

      // リセット
      await repo.resetToDefault();
      stored = await repo.getAll();
      const briefingReset = stored.find((c) => c.phaseKey === 'morning_briefing');
      expect(briefingReset?.endTime).toBe('09:15');
    });

    it('リセット後に getTodayPhaseHint が元の判定に戻る', async () => {
      const repo = createOperationalPhaseRepository();

      // カスタム: 朝会を10:00まで延長
      const custom = makeCustomConfig({
        morning_briefing: { endTime: '10:00' },
        arrival_intake: { startTime: '10:00' },
      });
      await repo.saveAll(custom);

      let stored = await repo.getAll();
      let hint = getTodayPhaseHint(dateAt('09:20'), stored);
      expect(hint.phase).toBe('morning-meeting');

      // リセット
      await repo.resetToDefault();
      stored = await repo.getAll();
      hint = getTodayPhaseHint(dateAt('09:20'), stored);
      expect(hint.phase).toBe('am-operation');
    });
  });

  // ────────────────────────────────────────
  // Scenario 4: フォールバック
  // ────────────────────────────────────────

  describe('フォールバック', () => {
    it('空の設定配列を渡しても画面が壊れない (DEFAULT にフォールバック)', () => {
      const hint = getTodayPhaseHint(dateAt('10:00'), []);
      // 旧ロジック: 10:00 → am-operation
      expect(hint.phase).toBe('am-operation');
      expect(hint.message).toBeTruthy();
      expect(hint.label).toBeTruthy();
    });

    it('DailyPhaseHintBanner も空設定で壊れない', () => {
      const hint = getDailyPhaseHint(dateAt('10:00'), []);
      expect(hint.phase).toBe('am-operation');
      expect(hint.message).toBeTruthy();
    });

    it('config 引数なしでも DEFAULT_PHASE_CONFIG で動作', () => {
      const hint = getTodayPhaseHint(dateAt('13:00'));
      expect(hint.phase).toBe('pm-operation');
    });
  });
});
