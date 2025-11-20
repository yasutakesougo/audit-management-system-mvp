/**
 * 負荷集中時間分析エンジンのテストスイート
 * Safety HUD の頭脳部分の動作を保証
 */

import { describe, expect, it } from 'vitest';
import {
    analyzeStability,
    generateIntegratedComment,
    getAllTimeSlotAnalysis,
    summarizePeakTimeSlots,
    type ConflictWithTime,
    type StabilityStatus,
} from '../peakTimeAnalysis';

describe('peakTimeAnalysis', () => {
  describe('timeToMinutes (internal function via getTimeSlotLabel)', () => {
    it('正常な時刻文字列を分単位に変換', () => {
      // getTimeSlotLabel経由で間接テスト
      const result1 = getAllTimeSlotAnalysis([[{ start: '00:00' }]], 60);
      expect(result1[0].slotLabel).toBe('00:00-01:00');

      const result2 = getAllTimeSlotAnalysis([[{ start: '23:59' }]], 60);
      expect(result2[0].slotLabel).toBe('23:00-24:00'); // 23:59は23時台なので23:00-24:00

      const result3 = getAllTimeSlotAnalysis([[{ start: '12:30' }]], 60);
      expect(result3[0].slotLabel).toBe('12:00-13:00');
    });

    it('不正な時刻フォーマットでもフォールバック', () => {
      // console.warnが出るが、フォールバックで処理される
      const result = getAllTimeSlotAnalysis([[{ start: 'invalid:time' }]], 60);
      expect(result[0].slotLabel).toBe('00:00-02:00'); // フォールバック値
    });
  });

  describe('getTimeSlotLabel (via getAllTimeSlotAnalysis)', () => {
    it('2時間スロット（デフォルト）での分類', () => {
      const conflicts: ConflictWithTime[][] = [
        [{ start: '09:00' }], // 08:00-10:00 スロット
        [{ start: '10:59' }], // 10:00-12:00 スロット
        [{ start: '11:00' }], // 10:00-12:00 スロット (同じ)
      ];

      const result = getAllTimeSlotAnalysis(conflicts);
      expect(result[0].slotLabel).toBe('10:00-12:00'); // 2日ヒット
      expect(result[0].hitDays).toBe(2);
      expect(result[1].slotLabel).toBe('08:00-10:00'); // 1日ヒット
      expect(result[1].hitDays).toBe(1);
    });

    it('1時間スロットでの細かい分類', () => {
      const conflicts: ConflictWithTime[][] = [
        [{ start: '14:15' }],
        [{ start: '15:30' }],
      ];

      const result = getAllTimeSlotAnalysis(conflicts, 60);
      expect(result).toHaveLength(2);
      expect(result[0].slotLabel).toBe('14:00-15:00');
      expect(result[1].slotLabel).toBe('15:00-16:00');
    });
  });

  describe('summarizePeakTimeSlots', () => {
    it('空配列の場合はnullを返す', () => {
      expect(summarizePeakTimeSlots([])).toBeNull();
    });

    it('コンフリクトが存在しない場合もnullを返す', () => {
      expect(summarizePeakTimeSlots([[], [], []])).toBeNull();
    });

    it('最も頻度の高いスロットを正しく特定', () => {
      const conflicts: ConflictWithTime[][] = [
        [{ start: '10:30' }], // day 1: 10:00-12:00
        [{ start: '11:45' }], // day 2: 10:00-12:00
        [{ start: '14:15' }], // day 3: 14:00-16:00
        [],                   // day 4: なし
      ];

      const result = summarizePeakTimeSlots(conflicts);
      expect(result).not.toBeNull();
      expect(result!.slotLabel).toBe('10:00-12:00');
      expect(result!.hitDays).toBe(2);
      expect(result!.totalDays).toBe(4);
      expect(result!.ratio).toBe(0.5);
    });

    it('高頻度の場合はhigh severity', () => {
      const conflicts: ConflictWithTime[][] = [
        [{ start: '11:00' }],
        [{ start: '11:30' }],
        [{ start: '12:00' }],
        [{ start: '10:30' }], // 5日中4日ヒット = ratio 0.8 (high)
        [], // 5日目はなし
      ];

      const result = summarizePeakTimeSlots(conflicts);
      expect(result!.severity).toBe('high');
      expect(result!.emoji).toBe('📈');
      expect(result!.comment).toContain('シフト配置の見直しやスタッフ増員');
    });

    it('中頻度の場合はmedium severity', () => {
      const conflicts: ConflictWithTime[][] = [
        [{ start: '11:00' }],
        [{ start: '11:30' }],
        [], [], [], // 5日中2日 = ratio 0.4
      ];

      const result = summarizePeakTimeSlots(conflicts);
      expect(result!.severity).toBe('medium');
      expect(result!.comment).toContain('業務フローを見直す');
    });

    it('低頻度の場合はlow severity', () => {
      const conflicts: ConflictWithTime[][] = [
        [{ start: '11:00' }],
        [], [], [], [], [], [], [], [], [], // 10日中1日 = ratio 0.1
      ];

      const result = summarizePeakTimeSlots(conflicts);
      expect(result!.severity).toBe('low');
      expect(result!.emoji).toBe('📉');
      expect(result!.comment).toContain('安定しています');
    });
  });

  describe('getAllTimeSlotAnalysis', () => {
    it('ヒット数の降順でソート', () => {
      const conflicts: ConflictWithTime[][] = [
        [{ start: '09:00' }], // 08:00-10:00
        [{ start: '11:00' }], // 10:00-12:00
        [{ start: '11:30' }], // 10:00-12:00 (same slot)
        [{ start: '15:00' }], // 14:00-16:00
      ];

      const result = getAllTimeSlotAnalysis(conflicts);
      expect(result).toHaveLength(3);
      expect(result[0].slotLabel).toBe('10:00-12:00'); // hitDays = 2
      expect(result[0].hitDays).toBe(2);
      expect(result[1].hitDays).toBe(1); // 他は1
      expect(result[2].hitDays).toBe(1);
    });

    it('同じ日の複数コンフリクトは1カウント', () => {
      const conflicts: ConflictWithTime[][] = [
        [
          { start: '11:00' },
          { start: '11:15' },
          { start: '11:45' }
        ], // 全て同じスロット、でも1日扱い
      ];

      const result = getAllTimeSlotAnalysis(conflicts);
      expect(result[0].hitDays).toBe(1);
      expect(result[0].totalDays).toBe(1);
      expect(result[0].ratio).toBe(1.0);
    });
  });

  describe('analyzeStability', () => {
    it('excellent状態: ピーク1日以下 & 平均0.5以下', () => {
      const result = analyzeStability(1, 0.3);
      expect(result.level).toBe('excellent');
      expect(result.emoji).toBe('🎯');
      expect(result.isStable).toBe(true);
      expect(result.message).toContain('非常に安定した運営');
    });

    it('good状態: ピーク2日以下 & 平均1.0以下', () => {
      const result = analyzeStability(2, 0.8);
      expect(result.level).toBe('good');
      expect(result.emoji).toBe('✅');
      expect(result.isStable).toBe(true);
    });

    it('improving状態: ピーク比率0.4以下 & 平均2.0以下', () => {
      const result = analyzeStability(2, 1.5, 7); // ratio = 2/7 ≈ 0.29
      expect(result.level).toBe('improving');
      expect(result.emoji).toBe('📈');
      expect(result.isStable).toBe(false);
    });

    it('needs_attention状態: 高い頻度または高い平均', () => {
      const result = analyzeStability(5, 3.0);
      expect(result.level).toBe('needs_attention');
      expect(result.emoji).toBe('⚠️');
      expect(result.isStable).toBe(false);
    });

    it('負数入力の安全な処理', () => {
      const result = analyzeStability(-5, -2.0);
      expect(result.level).toBe('excellent'); // 負数は0に補正される
      expect(result.isStable).toBe(true);
    });

    it('undefined入力の安全な処理', () => {
      const result = analyzeStability(undefined, 0.1);
      expect(result.level).toBe('excellent');
      expect(result.isStable).toBe(true);
    });

    it('totalDaysが0の場合の安全な処理', () => {
      const result = analyzeStability(3, 1.0, 0); // ゼロ除算防止
      expect(result).toBeDefined(); // クラッシュしない
    });
  });

  describe('generateIntegratedComment', () => {
    const mockPeakHigh = {
      slotLabel: '11:00-13:00',
      severity: 'high' as const,
      comment: 'テスト用高負荷コメント',
      emoji: '📈' as const,
      hitDays: 5,
      totalDays: 7,
      ratio: 0.71
    };

    const mockStabilityStable = {
      isStable: true,
      level: 'good' as const,
      emoji: '✅' as const,
      message: '安定した運営状況です',
      actionSuggestion: 'この調子を維持していきましょう。'
    };

    const mockStabilityImproving = {
      isStable: false,
      level: 'improving' as const,
      emoji: '📈' as const,
      message: '改善の傾向が見えています',
      actionSuggestion: 'もう一歩で安定化できそうです'
    };

    it('安定状態の場合はポジティブメッセージ優先', () => {
      const result = generateIntegratedComment(mockPeakHigh, mockStabilityStable);
      expect(result).toContain('✅');
      expect(result).toContain('安定した運営状況');
      expect(result).toContain('この調子を維持');
    });

    it('高負荷ピーク + 要改善の場合はピークメッセージ優先', () => {
      const stabilityBad: StabilityStatus = {
        isStable: false,
        level: 'needs_attention',
        emoji: '⚠️',
        message: 'シフト調整が必要',
        actionSuggestion: '配置を見直してください'
      };

      const result = generateIntegratedComment(mockPeakHigh, stabilityBad);
      expect(result).toContain('📈'); // ピークの絵文字
      expect(result).toContain('テスト用高負荷コメント');
      expect(result).toContain('配置を見直してください');
    });

    it('改善傾向の場合は励ましメッセージ', () => {
      const result = generateIntegratedComment(null, mockStabilityImproving);
      expect(result).toContain('📈');
      expect(result).toContain('改善の傾向');
      expect(result).toContain('もう一歩で安定化');
    });

    it('actionSuggestionがundefinedでも安全', () => {
      const stabilityNoSuggestion: StabilityStatus = {
        isStable: true,
        level: 'good',
        emoji: '✅',
        message: 'テストメッセージ',
        // actionSuggestionなし
      };

      const result = generateIntegratedComment(null, stabilityNoSuggestion);
      expect(result).toBe('✅ テストメッセージ'); // suggestionなしでも正常
    });
  });
});