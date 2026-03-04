import { describe, expect, it } from 'vitest';
import {
    getAllowedActions,
    getNextStatus,
    HANDOFF_STATUS_META,
    isTerminalStatus,
} from '../handoffStateMachine';
import type { HandoffStatus, MeetingMode } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Constants for readability
// ────────────────────────────────────────────────────────────

const ALL_STATUSES: HandoffStatus[] = [
  '未対応',
  '対応中',
  '対応済',
  '確認済',
  '明日へ持越',
  '完了',
];

const ALL_MODES: MeetingMode[] = ['normal', 'evening', 'morning'];

// ────────────────────────────────────────────────────────────
// HANDOFF_STATUS_META
// ────────────────────────────────────────────────────────────

describe('HANDOFF_STATUS_META', () => {
  it('has an entry for every HandoffStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(HANDOFF_STATUS_META[status]).toBeDefined();
    }
  });

  it('each entry has label, icon, and a valid MUI color', () => {
    const validColors = [
      'default',
      'primary',
      'secondary',
      'success',
      'warning',
      'error',
      'info',
    ];
    for (const status of ALL_STATUSES) {
      const meta = HANDOFF_STATUS_META[status];
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(validColors).toContain(meta.color);
    }
  });
});

// ────────────────────────────────────────────────────────────
// getNextStatus  (normal toggle cycle)
// ────────────────────────────────────────────────────────────

describe('getNextStatus', () => {
  it.each<[HandoffStatus, HandoffStatus]>([
    ['未対応', '対応中'],
    ['対応中', '対応済'],
  ])('%s → %s', (current, expected) => {
    expect(getNextStatus(current)).toBe(expected);
  });

  it('wraps back to 未対応 from 対応済 (reopen cycle)', () => {
    expect(getNextStatus('対応済')).toBe('未対応');
  });

  it('full 3-step cycle: 未対応 → 対応中 → 対応済 → 未対応', () => {
    let status: HandoffStatus = '未対応';
    status = getNextStatus(status); // 対応中
    expect(status).toBe('対応中');
    status = getNextStatus(status); // 対応済
    expect(status).toBe('対応済');
    status = getNextStatus(status); // 未対応
    expect(status).toBe('未対応');
  });
});

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
  ])('%s → terminal=%s', (status, expected) => {
    expect(isTerminalStatus(status)).toBe(expected);
  });

  it('terminal statuses produce no actions in ANY mode', () => {
    const terminalStatuses: HandoffStatus[] = ['対応済', '完了'];
    for (const status of terminalStatuses) {
      for (const mode of ALL_MODES) {
        expect(getAllowedActions(status, mode)).toEqual([]);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────
// getAllowedActions — evening mode (夕会)
// ────────────────────────────────────────────────────────────

describe('getAllowedActions – evening mode (夕会)', () => {
  const mode: MeetingMode = 'evening';

  it('未対応 → [確認済, 完了]', () => {
    expect(getAllowedActions('未対応', mode)).toEqual(['確認済', '完了']);
  });

  it('確認済 → [明日へ持越, 完了]', () => {
    expect(getAllowedActions('確認済', mode)).toEqual(['明日へ持越', '完了']);
  });

  it('対応中 → [対応済]  (legacy items landing in evening)', () => {
    expect(getAllowedActions('対応中', mode)).toEqual(['対応済']);
  });

  it('明日へ持越 → [] (not actionable in evening itself)', () => {
    expect(getAllowedActions('明日へ持越', mode)).toEqual([]);
  });

  it('terminal statuses return []', () => {
    expect(getAllowedActions('対応済', mode)).toEqual([]);
    expect(getAllowedActions('完了', mode)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// getAllowedActions — morning mode (朝会)
// ────────────────────────────────────────────────────────────

describe('getAllowedActions – morning mode (朝会)', () => {
  const mode: MeetingMode = 'morning';

  it('明日へ持越 → [完了]  (primary morning workflow)', () => {
    expect(getAllowedActions('明日へ持越', mode)).toEqual(['完了']);
  });

  it('未対応 → [完了]  (leftover items)', () => {
    expect(getAllowedActions('未対応', mode)).toEqual(['完了']);
  });

  it('確認済 → [完了]  (reviewed but not carried over)', () => {
    expect(getAllowedActions('確認済', mode)).toEqual(['完了']);
  });

  it('対応中 → [対応済]  (legacy in-progress items)', () => {
    expect(getAllowedActions('対応中', mode)).toEqual(['対応済']);
  });

  it('terminal statuses return []', () => {
    expect(getAllowedActions('対応済', mode)).toEqual([]);
    expect(getAllowedActions('完了', mode)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// getAllowedActions — normal mode (通常)
// ────────────────────────────────────────────────────────────

describe('getAllowedActions – normal mode (通常)', () => {
  const mode: MeetingMode = 'normal';

  it('未対応 → [対応中]  (start working)', () => {
    expect(getAllowedActions('未対応', mode)).toEqual(['対応中']);
  });

  it('対応中 → [対応済]  (mark done)', () => {
    expect(getAllowedActions('対応中', mode)).toEqual(['対応済']);
  });

  it('確認済 → [完了]  (fallback for v3 statuses in normal mode)', () => {
    expect(getAllowedActions('確認済', mode)).toEqual(['完了']);
  });

  it('明日へ持越 → [完了]  (fallback for v3 statuses in normal mode)', () => {
    expect(getAllowedActions('明日へ持越', mode)).toEqual(['完了']);
  });

  it('terminal statuses return []', () => {
    expect(getAllowedActions('対応済', mode)).toEqual([]);
    expect(getAllowedActions('完了', mode)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// Cross-cutting invariants
// ────────────────────────────────────────────────────────────

describe('state machine invariants', () => {
  it('getAllowedActions only returns valid HandoffStatus values', () => {
    for (const status of ALL_STATUSES) {
      for (const mode of ALL_MODES) {
        const actions = getAllowedActions(status, mode);
        for (const action of actions) {
          expect(ALL_STATUSES).toContain(action);
        }
      }
    }
  });

  it('no status allows transitioning to itself', () => {
    for (const status of ALL_STATUSES) {
      for (const mode of ALL_MODES) {
        const actions = getAllowedActions(status, mode);
        expect(actions).not.toContain(status);
      }
    }
  });

  it('every non-terminal status has at least one action in every mode (with known exceptions)', () => {
    // 明日へ持越 is intentionally non-actionable in evening mode —
    // carry-overs are only closed during the morning meeting.
    const KNOWN_EMPTY: Array<[HandoffStatus, MeetingMode]> = [
      ['明日へ持越', 'evening'],
    ];

    const nonTerminal = ALL_STATUSES.filter((s) => !isTerminalStatus(s));
    for (const status of nonTerminal) {
      for (const mode of ALL_MODES) {
        const isKnownException = KNOWN_EMPTY.some(
          ([s, m]) => s === status && m === mode
        );
        if (isKnownException) {
          expect(getAllowedActions(status, mode)).toEqual([]);
        } else {
          expect(getAllowedActions(status, mode).length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('evening 夕会 workflow: 未対応 → 確認済 → 明日へ持越 is reachable', () => {
    const step1 = getAllowedActions('未対応', 'evening');
    expect(step1).toContain('確認済');

    const step2 = getAllowedActions('確認済', 'evening');
    expect(step2).toContain('明日へ持越');
  });

  it('morning 朝会 closes carry-overs: 明日へ持越 → 完了 is reachable', () => {
    const actions = getAllowedActions('明日へ持越', 'morning');
    expect(actions).toContain('完了');
  });

  it('full evening→morning handoff path is possible', () => {
    // Evening: 未対応 → 確認済
    expect(getAllowedActions('未対応', 'evening')).toContain('確認済');
    // Evening: 確認済 → 明日へ持越
    expect(getAllowedActions('確認済', 'evening')).toContain('明日へ持越');
    // Morning: 明日へ持越 → 完了
    expect(getAllowedActions('明日へ持越', 'morning')).toContain('完了');
    // 完了 is terminal
    expect(isTerminalStatus('完了')).toBe(true);
  });
});
