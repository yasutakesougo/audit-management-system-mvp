/**
 * OperationalPhase — 単体テスト
 *
 * 検証項目:
 *   1. getCurrentPhase() の全フェーズ境界値
 *   2. getPhaseLabel() の全フェーズラベル
 *   3. getPrimaryScreen() の主役画面マッピング
 *   4. phaseSuggestsMeetingMode() の既存概念マッピング
 *   5. phaseSuggestsTodayScene() の既存概念マッピング
 *   6. phaseSuggestsTimeBand() の既存概念マッピング
 *   7. phaseSuggestsDashboardTime() の既存概念マッピング
 *   8. 深夜・早朝・日跨ぎの振る舞い
 */

import {
  getCurrentPhase,
  getPhaseLabel,
  getPrimaryScreen,
  phaseSuggestsMeetingMode,
  phaseSuggestsTodayScene,
  phaseSuggestsTimeBand,
  phaseSuggestsDashboardTime,
  ALL_PHASES,
  type OperationalPhase,
} from './operationalPhase';

// ── ヘルパー ──

/** テスト用のDate生成（時:分のみ指定） */
function makeDate(hour: number, minute: number): Date {
  const d = new Date(2026, 2, 13); // 2026-03-13（曜日関係なし）
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ────────────────────────────────────────
// getCurrentPhase()
// ────────────────────────────────────────

describe('getCurrentPhase', () => {
  // ── preparation: 06:00 (360) ~ 08:29 (509) ──

  it('returns preparation at 06:00 (boundary start)', () => {
    expect(getCurrentPhase(makeDate(6, 0))).toBe('preparation');
  });

  it('returns preparation at 07:30 (mid)', () => {
    expect(getCurrentPhase(makeDate(7, 30))).toBe('preparation');
  });

  it('returns preparation at 08:29 (boundary end)', () => {
    expect(getCurrentPhase(makeDate(8, 29))).toBe('preparation');
  });

  // ── morning-meeting: 08:30 (510) ~ 09:14 (554) ──

  it('returns morning-meeting at 08:30 (boundary start)', () => {
    expect(getCurrentPhase(makeDate(8, 30))).toBe('morning-meeting');
  });

  it('returns morning-meeting at 08:45 (mid)', () => {
    expect(getCurrentPhase(makeDate(8, 45))).toBe('morning-meeting');
  });

  it('returns morning-meeting at 09:14 (boundary end)', () => {
    expect(getCurrentPhase(makeDate(9, 14))).toBe('morning-meeting');
  });

  // ── am-operation: 09:15 (555) ~ 11:59 (719) ──

  it('returns am-operation at 09:15 (boundary start)', () => {
    expect(getCurrentPhase(makeDate(9, 15))).toBe('am-operation');
  });

  it('returns am-operation at 10:30 (mid)', () => {
    expect(getCurrentPhase(makeDate(10, 30))).toBe('am-operation');
  });

  it('returns am-operation at 11:59 (boundary end)', () => {
    expect(getCurrentPhase(makeDate(11, 59))).toBe('am-operation');
  });

  // ── pm-operation: 12:00 (720) ~ 15:29 (929) ──

  it('returns pm-operation at 12:00 (boundary start)', () => {
    expect(getCurrentPhase(makeDate(12, 0))).toBe('pm-operation');
  });

  it('returns pm-operation at 13:30 (mid)', () => {
    expect(getCurrentPhase(makeDate(13, 30))).toBe('pm-operation');
  });

  it('returns pm-operation at 15:29 (boundary end)', () => {
    expect(getCurrentPhase(makeDate(15, 29))).toBe('pm-operation');
  });

  // ── evening-closing: 15:30 (930) ~ 16:59 (1019) ──

  it('returns evening-closing at 15:30 (boundary start)', () => {
    expect(getCurrentPhase(makeDate(15, 30))).toBe('evening-closing');
  });

  it('returns evening-closing at 16:15 (mid)', () => {
    expect(getCurrentPhase(makeDate(16, 15))).toBe('evening-closing');
  });

  it('returns evening-closing at 16:59 (boundary end)', () => {
    expect(getCurrentPhase(makeDate(16, 59))).toBe('evening-closing');
  });

  // ── record-review: 17:00 (1020) ~ 05:59 (359) ──

  it('returns record-review at 17:00 (boundary start)', () => {
    expect(getCurrentPhase(makeDate(17, 0))).toBe('record-review');
  });

  it('returns record-review at 20:00 (night)', () => {
    expect(getCurrentPhase(makeDate(20, 0))).toBe('record-review');
  });

  it('returns record-review at 23:59 (near midnight)', () => {
    expect(getCurrentPhase(makeDate(23, 59))).toBe('record-review');
  });

  it('returns record-review at 00:00 (midnight)', () => {
    expect(getCurrentPhase(makeDate(0, 0))).toBe('record-review');
  });

  it('returns record-review at 03:00 (early morning)', () => {
    expect(getCurrentPhase(makeDate(3, 0))).toBe('record-review');
  });

  it('returns record-review at 05:59 (before preparation)', () => {
    expect(getCurrentPhase(makeDate(5, 59))).toBe('record-review');
  });

  // ── 連続境界テスト: フェーズ切り替えの1分差 ──

  it('transitions preparation → morning-meeting at 08:30', () => {
    expect(getCurrentPhase(makeDate(8, 29))).toBe('preparation');
    expect(getCurrentPhase(makeDate(8, 30))).toBe('morning-meeting');
  });

  it('transitions morning-meeting → am-operation at 09:15', () => {
    expect(getCurrentPhase(makeDate(9, 14))).toBe('morning-meeting');
    expect(getCurrentPhase(makeDate(9, 15))).toBe('am-operation');
  });

  it('transitions am-operation → pm-operation at 12:00', () => {
    expect(getCurrentPhase(makeDate(11, 59))).toBe('am-operation');
    expect(getCurrentPhase(makeDate(12, 0))).toBe('pm-operation');
  });

  it('transitions pm-operation → evening-closing at 15:30', () => {
    expect(getCurrentPhase(makeDate(15, 29))).toBe('pm-operation');
    expect(getCurrentPhase(makeDate(15, 30))).toBe('evening-closing');
  });

  it('transitions evening-closing → record-review at 17:00', () => {
    expect(getCurrentPhase(makeDate(16, 59))).toBe('evening-closing');
    expect(getCurrentPhase(makeDate(17, 0))).toBe('record-review');
  });

  it('transitions record-review → preparation at 06:00', () => {
    expect(getCurrentPhase(makeDate(5, 59))).toBe('record-review');
    expect(getCurrentPhase(makeDate(6, 0))).toBe('preparation');
  });
});

// ────────────────────────────────────────
// getPhaseLabel()
// ────────────────────────────────────────

describe('getPhaseLabel', () => {
  it.each<[OperationalPhase, string]>([
    ['preparation',     '出勤・朝準備'],
    ['morning-meeting', '朝会'],
    ['am-operation',    'AM活動'],
    ['pm-operation',    'PM活動'],
    ['evening-closing', '夕会・帰り支度'],
    ['record-review',   '記録・振り返り'],
  ])('returns "%s" → "%s"', (phase, expected) => {
    expect(getPhaseLabel(phase)).toBe(expected);
  });
});

// ────────────────────────────────────────
// getPrimaryScreen()
// ────────────────────────────────────────

describe('getPrimaryScreen', () => {
  it.each<[OperationalPhase, string]>([
    ['preparation',     '/today'],
    ['morning-meeting', '/handoff-timeline'],
    ['am-operation',    '/today'],
    ['pm-operation',    '/daily'],
    ['evening-closing', '/handoff-timeline'],
    ['record-review',   '/dashboard'],
  ])('returns "%s" → "%s"', (phase, expected) => {
    expect(getPrimaryScreen(phase)).toBe(expected);
  });
});

// ────────────────────────────────────────
// phaseSuggestsMeetingMode()
// ────────────────────────────────────────

describe('phaseSuggestsMeetingMode', () => {
  it('suggests morning mode during morning-meeting', () => {
    expect(phaseSuggestsMeetingMode('morning-meeting')).toBe('morning');
  });

  it('suggests evening mode during evening-closing', () => {
    expect(phaseSuggestsMeetingMode('evening-closing')).toBe('evening');
  });

  it.each<OperationalPhase>([
    'preparation',
    'am-operation',
    'pm-operation',
    'record-review',
  ])('suggests normal mode during %s', (phase) => {
    expect(phaseSuggestsMeetingMode(phase)).toBe('normal');
  });
});

// ────────────────────────────────────────
// phaseSuggestsTodayScene()
// ────────────────────────────────────────

describe('phaseSuggestsTodayScene', () => {
  it.each<[OperationalPhase, string]>([
    ['preparation',     'morning-briefing'],
    ['morning-meeting', 'morning-briefing'],
    ['am-operation',    'am-activity'],
    ['pm-operation',    'pm-activity'],
    ['evening-closing', 'day-closing'],
    ['record-review',   'day-closing'],
  ])('maps %s → %s', (phase, expected) => {
    expect(phaseSuggestsTodayScene(phase)).toBe(expected);
  });
});

// ────────────────────────────────────────
// phaseSuggestsTimeBand()
// ────────────────────────────────────────

describe('phaseSuggestsTimeBand', () => {
  it.each<[OperationalPhase, string]>([
    ['preparation',     '朝'],
    ['morning-meeting', '朝'],
    ['am-operation',    '午前'],
    ['pm-operation',    '午後'],
    ['evening-closing', '夕方'],
    ['record-review',   '夕方'],
  ])('maps %s → %s', (phase, expected) => {
    expect(phaseSuggestsTimeBand(phase)).toBe(expected);
  });
});

// ────────────────────────────────────────
// phaseSuggestsDashboardTime()
// ────────────────────────────────────────

describe('phaseSuggestsDashboardTime', () => {
  it('returns isMorningTime=true for preparation', () => {
    const result = phaseSuggestsDashboardTime('preparation');
    expect(result).toEqual({ isMorningTime: true, isEveningTime: false });
  });

  it('returns isMorningTime=true for morning-meeting', () => {
    const result = phaseSuggestsDashboardTime('morning-meeting');
    expect(result).toEqual({ isMorningTime: true, isEveningTime: false });
  });

  it('returns isMorningTime=true for am-operation', () => {
    const result = phaseSuggestsDashboardTime('am-operation');
    expect(result).toEqual({ isMorningTime: true, isEveningTime: false });
  });

  it('returns both false for pm-operation', () => {
    const result = phaseSuggestsDashboardTime('pm-operation');
    expect(result).toEqual({ isMorningTime: false, isEveningTime: false });
  });

  it('returns both false for evening-closing', () => {
    const result = phaseSuggestsDashboardTime('evening-closing');
    expect(result).toEqual({ isMorningTime: false, isEveningTime: false });
  });

  it('returns isEveningTime=true for record-review', () => {
    const result = phaseSuggestsDashboardTime('record-review');
    expect(result).toEqual({ isMorningTime: false, isEveningTime: true });
  });
});

// ────────────────────────────────────────
// ALL_PHASES
// ────────────────────────────────────────

describe('ALL_PHASES', () => {
  it('contains all 6 phases in order', () => {
    expect(ALL_PHASES).toEqual([
      'preparation',
      'morning-meeting',
      'am-operation',
      'pm-operation',
      'evening-closing',
      'record-review',
    ]);
  });

  it('is readonly', () => {
    // TypeScript compile-time check — verify it's a readonly array
    const phases: readonly OperationalPhase[] = ALL_PHASES;
    expect(phases).toHaveLength(6);
  });
});

// ────────────────────────────────────────
// 統合テスト: 時刻→フェーズ→全マッピングの一貫性
// ────────────────────────────────────────

describe('end-to-end: time → phase → mappings consistency', () => {
  it('08:30 → morning-meeting → /handoff + morning mode + 朝', () => {
    const phase = getCurrentPhase(makeDate(8, 30));
    expect(phase).toBe('morning-meeting');
    expect(getPrimaryScreen(phase)).toBe('/handoff-timeline');
    expect(phaseSuggestsMeetingMode(phase)).toBe('morning');
    expect(phaseSuggestsTimeBand(phase)).toBe('朝');
    expect(phaseSuggestsTodayScene(phase)).toBe('morning-briefing');
  });

  it('14:00 → pm-operation → /daily + normal mode + 午後', () => {
    const phase = getCurrentPhase(makeDate(14, 0));
    expect(phase).toBe('pm-operation');
    expect(getPrimaryScreen(phase)).toBe('/daily');
    expect(phaseSuggestsMeetingMode(phase)).toBe('normal');
    expect(phaseSuggestsTimeBand(phase)).toBe('午後');
    expect(phaseSuggestsTodayScene(phase)).toBe('pm-activity');
  });

  it('16:30 → evening-closing → /handoff + evening mode + 夕方', () => {
    const phase = getCurrentPhase(makeDate(16, 30));
    expect(phase).toBe('evening-closing');
    expect(getPrimaryScreen(phase)).toBe('/handoff-timeline');
    expect(phaseSuggestsMeetingMode(phase)).toBe('evening');
    expect(phaseSuggestsTimeBand(phase)).toBe('夕方');
    expect(phaseSuggestsTodayScene(phase)).toBe('day-closing');
  });

  it('18:00 → record-review → /dashboard + normal mode + 夕方', () => {
    const phase = getCurrentPhase(makeDate(18, 0));
    expect(phase).toBe('record-review');
    expect(getPrimaryScreen(phase)).toBe('/dashboard');
    expect(phaseSuggestsMeetingMode(phase)).toBe('normal');
    expect(phaseSuggestsTimeBand(phase)).toBe('夕方');
  });
});
