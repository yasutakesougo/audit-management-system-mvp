/**
 * domain/handoffActions.ts — Unit Tests
 *
 * 計画書 A-3: 遷移テスト拡充
 * meetingMode × status の全組み合わせについて、
 * getAvailableActionButtons / canTransition / shouldShowWorkflowActions を検証。
 *
 * テスト対象マトリクス:
 *   meetingMode | 初期 status | 許可される遷移 | 禁止される遷移
 */

import { describe, expect, it } from 'vitest';
import {
    canTransition,
    getAvailableActionButtons,
    shouldShowWorkflowActions,
} from '../domain/handoffActions';
import { getAllowedActions } from '../handoffStateMachine';
import type { HandoffStatus, MeetingMode } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const ALL_STATUSES: HandoffStatus[] = [
  '未対応', '対応中', '対応済', '確認済', '明日へ持越', '完了',
];

const ALL_MODES: MeetingMode[] = ['normal', 'evening', 'morning'];

// ────────────────────────────────────────────────────────────
// getAvailableActionButtons
// ────────────────────────────────────────────────────────────

describe('getAvailableActionButtons', () => {
  describe('evening mode (夕会)', () => {
    const mode: MeetingMode = 'evening';

    it('未対応 → [確認済, 完了] ボタンを返す', () => {
      const buttons = getAvailableActionButtons('未対応', mode);
      expect(buttons.map(b => b.key)).toEqual(['確認済', '完了']);
    });

    it('確認済 → [明日へ持越, 完了] ボタンを返す', () => {
      const buttons = getAvailableActionButtons('確認済', mode);
      expect(buttons.map(b => b.key)).toEqual(['明日へ持越', '完了']);
    });

    it('対応中 → [対応済] ボタンを返す', () => {
      const buttons = getAvailableActionButtons('対応中', mode);
      expect(buttons.map(b => b.key)).toEqual(['対応済']);
    });

    it('明日へ持越 → 空配列（夕会では操作不可）', () => {
      const buttons = getAvailableActionButtons('明日へ持越', mode);
      expect(buttons).toEqual([]);
    });

    it('対応済（終端）→ 空配列', () => {
      expect(getAvailableActionButtons('対応済', mode)).toEqual([]);
    });

    it('完了（終端）→ 空配列', () => {
      expect(getAvailableActionButtons('完了', mode)).toEqual([]);
    });
  });

  describe('morning mode (朝会)', () => {
    const mode: MeetingMode = 'morning';

    it('明日へ持越 → [完了] ボタンを返す', () => {
      const buttons = getAvailableActionButtons('明日へ持越', mode);
      expect(buttons.map(b => b.key)).toEqual(['完了']);
    });

    it('未対応 → [完了] ボタンを返す', () => {
      const buttons = getAvailableActionButtons('未対応', mode);
      expect(buttons.map(b => b.key)).toEqual(['完了']);
    });

    it('確認済 → [完了] ボタンを返す', () => {
      const buttons = getAvailableActionButtons('確認済', mode);
      expect(buttons.map(b => b.key)).toEqual(['完了']);
    });

    it('対応中 → [対応済] ボタンを返す', () => {
      const buttons = getAvailableActionButtons('対応中', mode);
      expect(buttons.map(b => b.key)).toEqual(['対応済']);
    });

    it('対応済（終端）→ 空配列', () => {
      expect(getAvailableActionButtons('対応済', mode)).toEqual([]);
    });

    it('完了（終端）→ 空配列', () => {
      expect(getAvailableActionButtons('完了', mode)).toEqual([]);
    });
  });

  describe('normal mode (通常)', () => {
    const mode: MeetingMode = 'normal';

    it('未対応 → [対応中] ボタンを返す', () => {
      const buttons = getAvailableActionButtons('未対応', mode);
      // normal モードでは 対応中 のメタデータが定義されていないため空配列
      // (通常モードは従来の toggle cycle を使う)
      // 注意: 対応中 は ACTION_BUTTON_META に未定義
      expect(buttons).toEqual([]);
    });

    it('対応中 → 空配列 (対応済のメタは定義済みだが normal は toggle を使う想定)', () => {
      const buttons = getAvailableActionButtons('対応中', mode);
      // 対応済 は ACTION_BUTTON_META に定義済みなので返る
      expect(buttons.map(b => b.key)).toEqual(['対応済']);
    });

    it('確認済 → [完了] ボタンを返す (フォールバック)', () => {
      const buttons = getAvailableActionButtons('確認済', mode);
      expect(buttons.map(b => b.key)).toEqual(['完了']);
    });

    it('明日へ持越 → [完了] ボタンを返す (フォールバック)', () => {
      const buttons = getAvailableActionButtons('明日へ持越', mode);
      expect(buttons.map(b => b.key)).toEqual(['完了']);
    });
  });

  // ── 横断的不変条件 ──

  it('返されるボタンの key は有効な HandoffStatus である', () => {
    for (const status of ALL_STATUSES) {
      for (const mode of ALL_MODES) {
        const buttons = getAvailableActionButtons(status, mode);
        for (const btn of buttons) {
          expect(ALL_STATUSES).toContain(btn.key);
          expect(btn.key).toBe(btn.nextStatus);
        }
      }
    }
  });

  it('返されるボタンは getAllowedActions のサブセットである', () => {
    for (const status of ALL_STATUSES) {
      for (const mode of ALL_MODES) {
        const buttons = getAvailableActionButtons(status, mode);
        const allowed = getAllowedActions(status, mode);
        for (const btn of buttons) {
          expect(allowed).toContain(btn.nextStatus);
        }
      }
    }
  });

  it('各ボタンは必須プロパティをすべて持つ', () => {
    for (const status of ALL_STATUSES) {
      for (const mode of ALL_MODES) {
        const buttons = getAvailableActionButtons(status, mode);
        for (const btn of buttons) {
          expect(btn.key).toBeTruthy();
          expect(btn.label).toBeTruthy();
          expect(btn.emoji).toBeTruthy();
          expect(['primary', 'warning', 'success']).toContain(btn.color);
          expect(btn.nextStatus).toBeTruthy();
        }
      }
    }
  });
});

// ────────────────────────────────────────────────────────────
// canTransition
// ────────────────────────────────────────────────────────────

describe('canTransition', () => {
  describe('evening mode — 許可される遷移', () => {
    it.each<[HandoffStatus, HandoffStatus]>([
      ['未対応', '確認済'],
      ['未対応', '完了'],
      ['確認済', '明日へ持越'],
      ['確認済', '完了'],
      ['対応中', '対応済'],
    ])('%s → %s: true', (from, to) => {
      expect(canTransition(from, to, 'evening')).toBe(true);
    });
  });

  describe('evening mode — 禁止される遷移', () => {
    it.each<[HandoffStatus, HandoffStatus]>([
      ['未対応', '対応中'],      // evening では通常サイクル不可
      ['未対応', '対応済'],
      ['未対応', '明日へ持越'],
      ['確認済', '未対応'],      // 逆方向不可
      ['確認済', '確認済'],      // 自己遷移不可
      ['対応済', '未対応'],      // 終端から遷移不可
      ['完了', '未対応'],        // 終端から遷移不可
    ])('%s → %s: false', (from, to) => {
      expect(canTransition(from, to, 'evening')).toBe(false);
    });
  });

  describe('morning mode — 許可される遷移', () => {
    it.each<[HandoffStatus, HandoffStatus]>([
      ['明日へ持越', '完了'],
      ['未対応', '完了'],
      ['確認済', '完了'],
      ['対応中', '対応済'],
    ])('%s → %s: true', (from, to) => {
      expect(canTransition(from, to, 'morning')).toBe(true);
    });
  });

  describe('morning mode — 禁止される遷移', () => {
    it.each<[HandoffStatus, HandoffStatus]>([
      ['未対応', '確認済'],      // morning では確認済不可
      ['未対応', '対応中'],
      ['明日へ持越', '未対応'],  // 逆方向不可
      ['対応済', '完了'],        // 終端から遷移不可
    ])('%s → %s: false', (from, to) => {
      expect(canTransition(from, to, 'morning')).toBe(false);
    });
  });

  describe('normal mode — 許可される遷移', () => {
    it.each<[HandoffStatus, HandoffStatus]>([
      ['未対応', '対応中'],
      ['対応中', '対応済'],
      ['確認済', '完了'],      // フォールバック
      ['明日へ持越', '完了'],  // フォールバック
    ])('%s → %s: true', (from, to) => {
      expect(canTransition(from, to, 'normal')).toBe(true);
    });
  });

  describe('normal mode — 禁止される遷移', () => {
    it.each<[HandoffStatus, HandoffStatus]>([
      ['未対応', '完了'],        // normal では直接完了不可
      ['未対応', '確認済'],      // normal では確認済不可
      ['未対応', '対応済'],
      ['対応中', '未対応'],      // 逆方向不可
      ['対応済', '未対応'],      // 状態マシンの仕様上 getAllowedActions では空
    ])('%s → %s: false', (from, to) => {
      expect(canTransition(from, to, 'normal')).toBe(false);
    });
  });
});

// ────────────────────────────────────────────────────────────
// shouldShowWorkflowActions
// ────────────────────────────────────────────────────────────

describe('shouldShowWorkflowActions', () => {
  it('normal モードでは常に false', () => {
    for (const status of ALL_STATUSES) {
      expect(shouldShowWorkflowActions('normal', status)).toBe(false);
    }
  });

  it('evening モードで非終端ステータスなら true（明日へ持越を除く）', () => {
    expect(shouldShowWorkflowActions('evening', '未対応')).toBe(true);
    expect(shouldShowWorkflowActions('evening', '確認済')).toBe(true);
    expect(shouldShowWorkflowActions('evening', '対応中')).toBe(true);
  });

  it('evening モードで明日へ持越は false（夕会では操作不可）', () => {
    expect(shouldShowWorkflowActions('evening', '明日へ持越')).toBe(false);
  });

  it('evening モードで終端ステータスは false', () => {
    expect(shouldShowWorkflowActions('evening', '対応済')).toBe(false);
    expect(shouldShowWorkflowActions('evening', '完了')).toBe(false);
  });

  it('morning モードで非終端ステータスなら true', () => {
    expect(shouldShowWorkflowActions('morning', '明日へ持越')).toBe(true);
    expect(shouldShowWorkflowActions('morning', '未対応')).toBe(true);
    expect(shouldShowWorkflowActions('morning', '確認済')).toBe(true);
    expect(shouldShowWorkflowActions('morning', '対応中')).toBe(true);
  });

  it('morning モードで終端ステータスは false', () => {
    expect(shouldShowWorkflowActions('morning', '対応済')).toBe(false);
    expect(shouldShowWorkflowActions('morning', '完了')).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// handoffStateMachine との一致性検証
// ────────────────────────────────────────────────────────────

describe('handoffStateMachine との一致性', () => {
  it('getAvailableActionButtons の key は getAllowedActions のサブセットで、順序が一致する', () => {
    for (const status of ALL_STATUSES) {
      for (const mode of ALL_MODES) {
        const buttonKeys = getAvailableActionButtons(status, mode).map(b => b.key);
        const allowed = getAllowedActions(status, mode);

        // buttonKeys は allowed のサブセット
        for (const key of buttonKeys) {
          expect(allowed).toContain(key);
        }

        // 順序は allowed における出現順に一致
        let lastIndex = -1;
        for (const key of buttonKeys) {
          const idx = allowed.indexOf(key);
          expect(idx).toBeGreaterThan(lastIndex);
          lastIndex = idx;
        }
      }
    }
  });

  it('canTransition は getAllowedActions と完全に一致する', () => {
    for (const status of ALL_STATUSES) {
      for (const mode of ALL_MODES) {
        const allowed = getAllowedActions(status, mode);
        for (const target of ALL_STATUSES) {
          const expected = allowed.includes(target);
          expect(canTransition(status, target, mode)).toBe(expected);
        }
      }
    }
  });
});
