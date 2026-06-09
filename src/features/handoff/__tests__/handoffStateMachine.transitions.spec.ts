import { describe, expect, it } from 'vitest';
import { getAllowedActions, isTerminalStatus } from '../handoffStateMachine';
import type { HandoffStatus, MeetingMode } from '../handoffTypes';

const ALL_STATUSES: HandoffStatus[] = [
  '未対応',
  '対応中',
  '対応済',
  '確認済',
  '明日へ持越',
  '完了',
];

const ALL_MODES: MeetingMode[] = ['normal', 'evening', 'morning'];

describe('Handoff state machine transitions', () => {
  describe('normal mode (通常) allowed actions', () => {
    const mode: MeetingMode = 'normal';

    it('未対応 → 対応中', () => {
      expect(getAllowedActions('未対応', mode)).toEqual(['対応中']);
    });

    it('対応中 → 対応済', () => {
      expect(getAllowedActions('対応中', mode)).toEqual(['対応済']);
    });

    it('確認済 → 完了（フォールバック）', () => {
      expect(getAllowedActions('確認済', mode)).toEqual(['完了']);
    });

    it('明日へ持越 → 完了（フォールバック）', () => {
      expect(getAllowedActions('明日へ持越', mode)).toEqual(['完了']);
    });
  });

  describe('evening mode (夕会) allowed actions', () => {
    const mode: MeetingMode = 'evening';

    it('未対応 → 確認済 / 完了', () => {
      expect(getAllowedActions('未対応', mode)).toEqual(['確認済', '完了']);
    });

    it('確認済 → 明日へ持越 / 完了', () => {
      expect(getAllowedActions('確認済', mode)).toEqual(['明日へ持越', '完了']);
    });

    it('対応中 → 対応済', () => {
      expect(getAllowedActions('対応中', mode)).toEqual(['対応済']);
    });

    it('明日へ持越 → []（朝会処理待ち）', () => {
      expect(getAllowedActions('明日へ持越', mode)).toEqual([]);
    });
  });

  describe('morning mode (朝会) allowed actions', () => {
    const mode: MeetingMode = 'morning';

    it('明日へ持越 → 完了', () => {
      expect(getAllowedActions('明日へ持越', mode)).toEqual(['完了']);
    });

    it('未対応 → 完了', () => {
      expect(getAllowedActions('未対応', mode)).toEqual(['完了']);
    });

    it('確認済 → 完了', () => {
      expect(getAllowedActions('確認済', mode)).toEqual(['完了']);
    });

    it('対応中 → 対応済', () => {
      expect(getAllowedActions('対応中', mode)).toEqual(['対応済']);
    });
  });

  describe('terminal behavior', () => {
    it.each<[HandoffStatus, MeetingMode]>([
      ['対応済', 'normal'],
      ['対応済', 'evening'],
      ['対応済', 'morning'],
      ['完了', 'normal'],
      ['完了', 'evening'],
      ['完了', 'morning'],
    ])('%s is terminal for %s mode and has no actions', (status, mode) => {
      expect(isTerminalStatus(status)).toBe(true);
      expect(getAllowedActions(status, mode)).toEqual([]);
    });

    it('terminal 以外はモード関係なく isTerminalStatus=false', () => {
      for (const status of ALL_STATUSES) {
        if (status === '対応済' || status === '完了') {
          continue;
        }
        expect(isTerminalStatus(status)).toBe(false);
      }
    });
  });

  describe('reopen restriction scenario', () => {
    it('対応済/完了 から未対応に戻す遷移は workflow actions としては露出しない', () => {
      for (const mode of ALL_MODES) {
        expect(getAllowedActions('対応済', mode)).not.toContain('未対応');
        expect(getAllowedActions('完了', mode)).not.toContain('未対応');
      }
    });

    it('対応済/完了 を非管理者が再開できる allowed action は発生しない（現仕様）', () => {
      for (const mode of ALL_MODES) {
        expect(getAllowedActions('対応済', mode)).toEqual([]);
        expect(getAllowedActions('完了', mode)).toEqual([]);
      }
    });
  });
});
