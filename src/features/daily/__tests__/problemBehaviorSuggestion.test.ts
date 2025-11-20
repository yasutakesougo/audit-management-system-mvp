/**
 * Phase 11B: 問題行動自動提案システムのテスト
 */

import { describe, expect, it } from 'vitest';

// テスト対象の関数を直接テストするために、DailyRecordFormから抽出
function buildProblemBehaviorSuggestion(
  handoffs: { message: string; category?: string }[]
): {
  selfHarm: boolean;
  violence: boolean;
  loudVoice: boolean;
  pica: boolean;
  other: boolean;
  otherDetail: string;
} {
  const suggestion = {
    selfHarm: false,
    violence: false,
    loudVoice: false,
    pica: false,
    other: false,
    otherDetail: ''
  };

  const text = handoffs.map(h => h.message).join('\n');

  // 自傷系
  if (text.match(/自傷|自分を叩く|頭を打つ|自分を殴る|自分.*叩く|自分.*打つ/)) {
    suggestion.selfHarm = true;
  }

  // 暴力・他害系
  if (text.match(/他害|職員.*殴る|職員.*蹴る|職員.*叩く|利用者.*殴る|利用者.*蹴る|利用者.*叩く|暴力/) && !suggestion.selfHarm) {
    suggestion.violence = true;
  }

  // 大声・奇声系
  if (text.match(/大声|叫ぶ|奇声|怒鳴る/)) {
    suggestion.loudVoice = true;
  }

  // 異食系
  if (text.match(/異食|口に入れる|拾い食い|食べてはいけないもの/)) {
    suggestion.pica = true;
  }

  // その他（今は「その他詳細」に文全体を入れるだけ、将来拡張可）
  if (!suggestion.selfHarm && !suggestion.violence && !suggestion.loudVoice && !suggestion.pica) {
    if (text.trim().length > 0) {
      suggestion.other = true;
      suggestion.otherDetail = '申し送り内容に基づく行動上の注意あり';
    }
  }

  return suggestion;
}

function isProblemBehaviorEmpty(pb: {
  selfHarm: boolean;
  violence: boolean;
  loudVoice: boolean;
  pica: boolean;
  other: boolean;
  otherDetail: string;
} | undefined): boolean {
  if (!pb) return true;
  return (
    !pb.selfHarm &&
    !pb.violence &&
    !pb.loudVoice &&
    !pb.pica &&
    !pb.other &&
    !pb.otherDetail
  );
}

describe('Problem Behavior Suggestion System (Phase 11B)', () => {
  describe('buildProblemBehaviorSuggestion', () => {
    it('自傷行動を正しく検出する', () => {
      const handoffs = [
        { message: '田中さんが自傷行動を起こしました。頭を打つ行為が見られます。' },
      ];

      const result = buildProblemBehaviorSuggestion(handoffs);

      expect(result.selfHarm).toBe(true);
      expect(result.violence).toBe(false);
      expect(result.loudVoice).toBe(false);
      expect(result.pica).toBe(false);
      expect(result.other).toBe(false);
    });

    it('暴力行動を正しく検出する', () => {
      const handoffs = [
        { message: '佐藤さんが他害行為、職員を殴る場面がありました。' },
      ];

      const result = buildProblemBehaviorSuggestion(handoffs);

      expect(result.selfHarm).toBe(false);
      expect(result.violence).toBe(true);
      expect(result.loudVoice).toBe(false);
      expect(result.pica).toBe(false);
      expect(result.other).toBe(false);
    });

    it('大声・奇声を正しく検出する', () => {
      const handoffs = [
        { message: '山田さんが大声を出し、奇声を発していました。' },
      ];

      const result = buildProblemBehaviorSuggestion(handoffs);

      expect(result.selfHarm).toBe(false);
      expect(result.violence).toBe(false);
      expect(result.loudVoice).toBe(true);
      expect(result.pica).toBe(false);
      expect(result.other).toBe(false);
    });

    it('異食行動を正しく検出する', () => {
      const handoffs = [
        { message: '鈴木さんが異食行為、食べてはいけないものを口に入れる行為がありました。' },
      ];

      const result = buildProblemBehaviorSuggestion(handoffs);

      expect(result.selfHarm).toBe(false);
      expect(result.violence).toBe(false);
      expect(result.loudVoice).toBe(false);
      expect(result.pica).toBe(true);
      expect(result.other).toBe(false);
    });

    it('複数の問題行動を同時に検出する', () => {
      const handoffs = [
        { message: '田中さんが自傷行為をした後、大声で叫んでいました。' },
      ];

      const result = buildProblemBehaviorSuggestion(handoffs);

      expect(result.selfHarm).toBe(true);
      expect(result.violence).toBe(false);
      expect(result.loudVoice).toBe(true);
      expect(result.pica).toBe(false);
      expect(result.other).toBe(false);
    });

    it('該当しない場合はその他として扱う', () => {
      const handoffs = [
        { message: '今日は天気が良く、散歩を楽しんでいました。' },
      ];

      const result = buildProblemBehaviorSuggestion(handoffs);

      expect(result.selfHarm).toBe(false);
      expect(result.violence).toBe(false);
      expect(result.loudVoice).toBe(false);
      expect(result.pica).toBe(false);
      expect(result.other).toBe(true);
      expect(result.otherDetail).toBe('申し送り内容に基づく行動上の注意あり');
    });

    it('空の申し送りでは何も提案しない', () => {
      const handoffs: { message: string; category?: string }[] = [];

      const result = buildProblemBehaviorSuggestion(handoffs);

      expect(result.selfHarm).toBe(false);
      expect(result.violence).toBe(false);
      expect(result.loudVoice).toBe(false);
      expect(result.pica).toBe(false);
      expect(result.other).toBe(false);
      expect(result.otherDetail).toBe('');
    });

    it('複数の申し送りメッセージを統合して判定する', () => {
      const handoffs = [
        { message: '田中さんが午前中に不穏でした。' },
        { message: '午後には大声を出していました。' },
        { message: '職員への暴力もありました。' }
      ];

      const result = buildProblemBehaviorSuggestion(handoffs);

      expect(result.selfHarm).toBe(false);
      expect(result.violence).toBe(true);
      expect(result.loudVoice).toBe(true);
      expect(result.pica).toBe(false);
      expect(result.other).toBe(false);
    });
  });

  describe('isProblemBehaviorEmpty', () => {
    it('空の問題行動データを正しく判定する', () => {
      const empty1 = undefined;
      const empty2 = {
        selfHarm: false,
        violence: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      };

      expect(isProblemBehaviorEmpty(empty1)).toBe(true);
      expect(isProblemBehaviorEmpty(empty2)).toBe(true);
    });

    it('データが入っている問題行動を正しく判定する', () => {
      const notEmpty1 = {
        selfHarm: true,
        violence: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      };

      const notEmpty2 = {
        selfHarm: false,
        violence: false,
        loudVoice: false,
        pica: false,
        other: true,
        otherDetail: '何かしらの記録'
      };

      expect(isProblemBehaviorEmpty(notEmpty1)).toBe(false);
      expect(isProblemBehaviorEmpty(notEmpty2)).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('実際の施設での申し送りパターンをテストする', () => {
      const realWorldScenarios = [
        {
          name: '自傷の典型パターン',
          handoffs: [{ message: '利用者Aさんが午前中に自分を叩く行為が数回見られました。注意深く見守りが必要です。' }],
          expected: { selfHarm: true, violence: false, loudVoice: false, pica: false, other: false }
        },
        {
          name: '他害の典型パターン',
          handoffs: [{ message: '利用者Bさんが興奮状態になり、近くにいた職員を殴る行為がありました。' }],
          expected: { selfHarm: false, violence: true, loudVoice: false, pica: false, other: false }
        },
        {
          name: '異食の典型パターン',
          handoffs: [{ message: '利用者Cさんが作業中に紙を口に入れる行為がありました。拾い食いにも注意。' }],
          expected: { selfHarm: false, violence: false, loudVoice: false, pica: true, other: false }
        },
        {
          name: '複合的な問題行動',
          handoffs: [{ message: '利用者Dさんが大声で怒鳴った後、自分の頭を打つ行為がありました。職員への暴力はありませんでした。' }],
          expected: { selfHarm: true, violence: false, loudVoice: true, pica: false, other: false }
        }
      ];

      realWorldScenarios.forEach(scenario => {
        const result = buildProblemBehaviorSuggestion(scenario.handoffs);

        expect(result.selfHarm, `${scenario.name}: selfHarm`).toBe(scenario.expected.selfHarm);
        expect(result.violence, `${scenario.name}: violence`).toBe(scenario.expected.violence);
        expect(result.loudVoice, `${scenario.name}: loudVoice`).toBe(scenario.expected.loudVoice);
        expect(result.pica, `${scenario.name}: pica`).toBe(scenario.expected.pica);
        expect(result.other, `${scenario.name}: other`).toBe(scenario.expected.other);
      });
    });
  });
});