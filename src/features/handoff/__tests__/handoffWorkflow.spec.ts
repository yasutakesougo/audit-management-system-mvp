import { describe, expect, it } from 'vitest';
import {
    getAllowedActions,
    getNextStatus,
    isTerminalStatus,
    type HandoffStatus,
    type MeetingMode,
} from '../handoffTypes';

describe('isTerminalStatus', () => {
  it.each<[HandoffStatus, boolean]>([
    ['未対応', false],
    ['対応中', false],
    ['確認済', false],
    ['明日へ持越', false],
    ['対応済', true],
    ['完了', true],
  ])('isTerminalStatus("%s") => %s', (status, expected) => {
    expect(isTerminalStatus(status)).toBe(expected);
  });
});

describe('getNextStatus (既存互換)', () => {
  it('未対応 → 対応中', () => {
    expect(getNextStatus('未対応')).toBe('対応中');
  });

  it('対応中 → 対応済', () => {
    expect(getNextStatus('対応中')).toBe('対応済');
  });

  it('対応済 → 未対応 (リセット)', () => {
    expect(getNextStatus('対応済')).toBe('未対応');
  });

  it('確認済 → 未対応 (フォールスルー)', () => {
    expect(getNextStatus('確認済')).toBe('未対応');
  });
});

describe('getAllowedActions', () => {
  describe('eveningモード', () => {
    const mode: MeetingMode = 'evening';

    it('未対応 → [確認済]', () => {
      const actions = getAllowedActions('未対応', mode);
      expect(actions).toHaveLength(1);
      expect(actions[0].targetStatus).toBe('確認済');
    });

    it('確認済 → [明日へ持越, 完了]', () => {
      const actions = getAllowedActions('確認済', mode);
      expect(actions).toHaveLength(2);
      expect(actions.map(a => a.targetStatus)).toEqual(['明日へ持越', '完了']);
    });

    it('明日へ持越 にはcarryOverDateフラグが立つ', () => {
      const actions = getAllowedActions('確認済', mode);
      const carryOver = actions.find(a => a.targetStatus === '明日へ持越');
      expect(carryOver?.setsCarryOverDate).toBe(true);
    });

    it('対応中 → [] (アクションなし)', () => {
      expect(getAllowedActions('対応中', mode)).toEqual([]);
    });

    it('対応済 → [] (終端)', () => {
      expect(getAllowedActions('対応済', mode)).toEqual([]);
    });

    it('完了 → [] (終端)', () => {
      expect(getAllowedActions('完了', mode)).toEqual([]);
    });
  });

  describe('morningモード', () => {
    const mode: MeetingMode = 'morning';

    it('明日へ持越 → [完了]', () => {
      const actions = getAllowedActions('明日へ持越', mode);
      expect(actions).toHaveLength(1);
      expect(actions[0].targetStatus).toBe('完了');
    });

    it('未対応 → [] (朝会ではアクション不可)', () => {
      expect(getAllowedActions('未対応', mode)).toEqual([]);
    });

    it('確認済 → []', () => {
      expect(getAllowedActions('確認済', mode)).toEqual([]);
    });
  });

  describe('normalモード', () => {
    const mode: MeetingMode = 'normal';

    it('どのステータスでも空 (既存Chipサイクルを使う)', () => {
      const statuses: HandoffStatus[] = ['未対応', '対応中', '対応済', '確認済', '明日へ持越', '完了'];
      for (const s of statuses) {
        expect(getAllowedActions(s, mode)).toEqual([]);
      }
    });
  });
});
