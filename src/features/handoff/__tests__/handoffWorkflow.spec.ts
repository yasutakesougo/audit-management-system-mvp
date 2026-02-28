/**
 * handoffWorkflow.spec.ts
 *
 * v3 ワークフロー状態遷移の全パターンテスト
 * - getAllowedActions(status, mode) : 6 status × 3 mode = 18 ケース
 * - isTerminalStatus(status)
 */
import type { HandoffStatus, MeetingMode } from '../handoffTypes';
import { getAllowedActions, isTerminalStatus } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// isTerminalStatus
// ────────────────────────────────────────────────────────────

describe('isTerminalStatus', () => {
  it.each<[HandoffStatus, boolean]>([
    ['未対応', false],
    ['対応中', false],
    ['確認済', false],
    ['明日へ持越', false],
    ['対応済', true],
    ['完了', true],
  ])('isTerminalStatus(%s) → %s', (status, expected) => {
    expect(isTerminalStatus(status)).toBe(expected);
  });
});

// ────────────────────────────────────────────────────────────
// getAllowedActions
// ────────────────────────────────────────────────────────────

describe('getAllowedActions', () => {
  // 全 status 値
  const allStatuses: HandoffStatus[] = [
    '未対応', '対応中', '対応済', '確認済', '明日へ持越', '完了',
  ];

  // 終端ステータスはどのモードでもアクションなし
  describe('terminal statuses', () => {
    const terminalStatuses: HandoffStatus[] = ['対応済', '完了'];
    const modes: MeetingMode[] = ['normal', 'evening', 'morning'];

    terminalStatuses.forEach((status) => {
      modes.forEach((mode) => {
        it(`getAllowedActions('${status}', '${mode}') → []`, () => {
          expect(getAllowedActions(status, mode)).toEqual([]);
        });
      });
    });
  });

  // normal モード
  describe('normal mode', () => {
    it('未対応 → [対応中]', () => {
      expect(getAllowedActions('未対応', 'normal')).toEqual(['対応中']);
    });

    it('対応中 → [対応済]', () => {
      expect(getAllowedActions('対応中', 'normal')).toEqual(['対応済']);
    });

    it('確認済 → [完了] (フォールバック)', () => {
      expect(getAllowedActions('確認済', 'normal')).toEqual(['完了']);
    });

    it('明日へ持越 → [完了] (フォールバック)', () => {
      expect(getAllowedActions('明日へ持越', 'normal')).toEqual(['完了']);
    });
  });

  // evening 夕会モード
  describe('evening mode', () => {
    it('未対応 → [確認済, 完了]', () => {
      expect(getAllowedActions('未対応', 'evening')).toEqual(['確認済', '完了']);
    });

    it('確認済 → [明日へ持越, 完了]', () => {
      expect(getAllowedActions('確認済', 'evening')).toEqual(['明日へ持越', '完了']);
    });

    it('対応中 → [対応済]', () => {
      expect(getAllowedActions('対応中', 'evening')).toEqual(['対応済']);
    });

    it('明日へ持越 → []', () => {
      expect(getAllowedActions('明日へ持越', 'evening')).toEqual([]);
    });
  });

  // morning 朝会モード
  describe('morning mode', () => {
    it('明日へ持越 → [完了]', () => {
      expect(getAllowedActions('明日へ持越', 'morning')).toEqual(['完了']);
    });

    it('未対応 → [完了]', () => {
      expect(getAllowedActions('未対応', 'morning')).toEqual(['完了']);
    });

    it('確認済 → [完了]', () => {
      expect(getAllowedActions('確認済', 'morning')).toEqual(['完了']);
    });

    it('対応中 → [対応済]', () => {
      expect(getAllowedActions('対応中', 'morning')).toEqual(['対応済']);
    });
  });

  // 全パターンが定義されていることを検証
  describe('exhaustiveness', () => {
    const modes: MeetingMode[] = ['normal', 'evening', 'morning'];

    allStatuses.forEach((status) => {
      modes.forEach((mode) => {
        it(`getAllowedActions('${status}', '${mode}') returns an array`, () => {
          const result = getAllowedActions(status, mode);
          expect(Array.isArray(result)).toBe(true);
        });
      });
    });
  });
});
