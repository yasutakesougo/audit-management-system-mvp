import { describe, expect, it } from 'vitest';
import {
  resolveSupportFlowForUser,
  fallbackSupportActivities,
  type SupportStrategyStage,
} from '../supportFlow';

// ── resolveSupportFlowForUser ──────────────────────────────────

describe('resolveSupportFlowForUser', () => {
  describe('with storedProcedures (priority 1)', () => {
    it('returns deployment from stored procedures', () => {
      const stored = [
        { time: '09:00', activity: '朝の会', instruction: '声かけする' },
      ];
      const result = resolveSupportFlowForUser('U999', stored);
      expect(result).not.toBeNull();
      expect(result!.planId).toBe('import-U999');
      expect(result!.activities).toHaveLength(1);
    });

    it('sets planName with userId', () => {
      const stored = [
        { time: '10:00', activity: '個別課題', instruction: '見守り' },
      ];
      const result = resolveSupportFlowForUser('U123', stored);
      expect(result!.planName).toContain('U123');
    });

    it('sets author as CSVインポート', () => {
      const stored = [
        { time: '09:00', activity: 'テスト', instruction: '支援' },
      ];
      const result = resolveSupportFlowForUser('U001', stored);
      expect(result!.author).toBe('CSVインポート');
    });

    it('parses activity with " - " separator for title/personTodo', () => {
      const stored = [
        { time: '10:00', activity: '個別課題 - パズルに取り組む', instruction: '' },
      ];
      const result = resolveSupportFlowForUser('U001', stored);
      const act = result!.activities[0];
      expect(act.title).toBe('個別課題');
      expect(act.personTodo).toBe('パズルに取り組む');
    });

    it('uses full activity as title and personTodo when no separator', () => {
      const stored = [
        { time: '10:00', activity: '自由時間', instruction: '' },
      ];
      const result = resolveSupportFlowForUser('U001', stored);
      const act = result!.activities[0];
      expect(act.title).toBe('自由時間');
      expect(act.personTodo).toBe('自由時間');
    });

    it('uses instruction as supporterTodo', () => {
      const stored = [
        { time: '09:00', activity: 'テスト', instruction: '安全確認する' },
      ];
      const result = resolveSupportFlowForUser('U001', stored);
      expect(result!.activities[0].supporterTodo).toBe('安全確認する');
    });

    it('falls back supporterTodo when instruction is empty', () => {
      const stored = [
        { time: '09:00', activity: 'テスト', instruction: '' },
      ];
      const result = resolveSupportFlowForUser('U001', stored);
      expect(result!.activities[0].supporterTodo).toBe('支援内容を設定してください');
    });

    it('ignores null storedProcedures', () => {
      const result = resolveSupportFlowForUser('001', null);
      expect(result).not.toBeNull(); // falls through to hardcoded
    });

    it('ignores empty storedProcedures array', () => {
      const result = resolveSupportFlowForUser('001', []);
      expect(result).not.toBeNull(); // falls through to hardcoded
    });
  });

  describe('hardcoded fallback (priority 2)', () => {
    it('returns plan for userId 001', () => {
      const result = resolveSupportFlowForUser('001');
      expect(result).not.toBeNull();
      expect(result!.planId).toBe('plan-001-v2');
      expect(result!.planName).toContain('田中太郎');
    });

    it('returns plan for userId 012', () => {
      const result = resolveSupportFlowForUser('012');
      expect(result).not.toBeNull();
      expect(result!.planId).toBe('plan-012-v1');
      expect(result!.planName).toContain('山田一郎');
    });

    it('returns null for unknown userId', () => {
      const result = resolveSupportFlowForUser('999');
      expect(result).toBeNull();
    });
  });
});

// ── inferStageFromTime (tested through resolveSupportFlowForUser) ─

describe('stage inference from time', () => {
  const cases: Array<[string, SupportStrategyStage]> = [
    ['09:00', 'proactive'],       // < 11 → proactive
    ['10:59', 'proactive'],       // < 11 → proactive
    ['11:00', 'earlyResponse'],   // 11-12 → earlyResponse
    ['12:30', 'earlyResponse'],   // < 13 → earlyResponse
    ['13:00', 'proactive'],       // 13-14 → proactive
    ['14:59', 'proactive'],       // < 15 → proactive
    ['15:00', 'postCrisis'],      // >= 15 → postCrisis
    ['16:30', 'postCrisis'],      // >= 15 → postCrisis
  ];

  it.each(cases)(
    'time %s → stage %s',
    (time, expectedStage) => {
      const stored = [{ time, activity: 'テスト', instruction: '支援' }];
      const result = resolveSupportFlowForUser('U999', stored);
      expect(result!.activities[0].stage).toBe(expectedStage);
    },
  );

  it('defaults to proactive for invalid time format', () => {
    const stored = [{ time: 'invalid', activity: 'テスト', instruction: '' }];
    const result = resolveSupportFlowForUser('U999', stored);
    expect(result!.activities[0].stage).toBe('proactive');
  });
});

// ── fallbackSupportActivities ──────────────────────────────────

describe('fallbackSupportActivities', () => {
  it('has 6 default activities', () => {
    expect(fallbackSupportActivities).toHaveLength(6);
  });

  it('first activity starts at 09:00', () => {
    expect(fallbackSupportActivities[0].time).toBe('09:00');
  });

  it('each activity has required fields', () => {
    for (const act of fallbackSupportActivities) {
      expect(act.time).toBeDefined();
      expect(act.title).toBeDefined();
      expect(act.personTodo).toBeDefined();
      expect(act.supporterTodo).toBeDefined();
      expect(act.stage).toBeDefined();
    }
  });
});
