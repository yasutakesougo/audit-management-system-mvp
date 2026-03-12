import {
    buildDailyHubFromTodayUrl,
    buildHandoffFromTodayState,
    buildIcebergPdcaUrl,
    buildSupportPlanMonitoringUrl,
    buildTodayReturnUrl,
    parseNavQuery,
    sceneToTimeBand,
} from '../navigationLinks';

// ---------------------------------------------------------------------------
// navigationLinks — ユニットテスト
// ---------------------------------------------------------------------------

describe('buildDailyHubFromTodayUrl', () => {
  it('日付なしで from=today のみ', () => {
    expect(buildDailyHubFromTodayUrl()).toBe('/dailysupport?from=today');
  });

  it('日付ありで from + date を付与', () => {
    expect(buildDailyHubFromTodayUrl('2026-02-28')).toBe(
      '/dailysupport?from=today&date=2026-02-28',
    );
  });

  it('空文字の date は無視される', () => {
    expect(buildDailyHubFromTodayUrl('  ')).toBe('/dailysupport?from=today');
  });
});

describe('buildTodayReturnUrl', () => {
  it('日付なしではクエリなし', () => {
    expect(buildTodayReturnUrl()).toBe('/today');
  });

  it('日付ありで date を付与', () => {
    expect(buildTodayReturnUrl('2026-02-28')).toBe('/today?date=2026-02-28');
  });

  it('空文字の date は無視される', () => {
    expect(buildTodayReturnUrl('')).toBe('/today');
  });
});

describe('parseNavQuery', () => {
  it('from=today & date を正しくパースする', () => {
    const params = new URLSearchParams('from=today&date=2026-02-28');
    expect(parseNavQuery(params)).toEqual({
      from: 'today',
      date: '2026-02-28',
    });
  });

  it('空のパラメータは undefined を返す', () => {
    const params = new URLSearchParams('');
    expect(parseNavQuery(params)).toEqual({
      from: undefined,
      date: undefined,
    });
  });

  it('許可リスト外の from は undefined にする', () => {
    const params = new URLSearchParams('from=unknown&date=2026-02-28');
    expect(parseNavQuery(params)).toEqual({
      from: undefined,
      date: '2026-02-28',
    });
  });

  it('date のみ（from なし）', () => {
    const params = new URLSearchParams('date=2026-02-28');
    expect(parseNavQuery(params)).toEqual({
      from: undefined,
      date: '2026-02-28',
    });
  });
});

// ---------------------------------------------------------------------------
// sceneToTimeBand — Scene → 時間帯フィルタ マッピング
// ---------------------------------------------------------------------------

describe('sceneToTimeBand', () => {
  it.each([
    ['morning-briefing', 'morning'],
    ['arrival-intake', 'morning'],
    ['before-am-activity', 'morning'],
    ['am-activity', 'morning'],
  ] as const)('%s → morning', (scene, expected) => {
    expect(sceneToTimeBand(scene)).toBe(expected);
  });

  it.each([
    ['post-activity', 'evening'],
    ['before-departure', 'evening'],
    ['day-closing', 'evening'],
  ] as const)('%s → evening', (scene, expected) => {
    expect(sceneToTimeBand(scene)).toBe(expected);
  });

  it.each([
    'lunch-transition',
    'before-pm-activity',
    'pm-activity',
  ] as const)('%s → undefined (全件表示)', (scene) => {
    expect(sceneToTimeBand(scene)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildHandoffFromTodayState — /today → /handoff-timeline 遷移 state
// ---------------------------------------------------------------------------

describe('buildHandoffFromTodayState', () => {
  it('デフォルトで dayScope=today, timeFilter=all, from=today', () => {
    expect(buildHandoffFromTodayState()).toEqual({
      dayScope: 'today',
      timeFilter: 'all',
      focusUserId: undefined,
      from: 'today',
    });
  });

  it('timeFilter を指定できる', () => {
    const state = buildHandoffFromTodayState({ timeFilter: 'morning' });
    expect(state.timeFilter).toBe('morning');
    expect(state.from).toBe('today');
  });

  it('focusUserId を指定できる', () => {
    const state = buildHandoffFromTodayState({ focusUserId: 'U001' });
    expect(state.focusUserId).toBe('U001');
    expect(state.dayScope).toBe('today');
  });

  it('timeFilter=undefined の場合は all にフォールバック', () => {
    const state = buildHandoffFromTodayState({ timeFilter: undefined });
    expect(state.timeFilter).toBe('all');
  });
});

// ---------------------------------------------------------------------------
// buildIcebergPdcaUrl — Daily → Iceberg PDCA 導線
// ---------------------------------------------------------------------------

describe('buildIcebergPdcaUrl', () => {
  it('userId を query param に含める', () => {
    expect(buildIcebergPdcaUrl('I022')).toBe('/analysis/iceberg-pdca?userId=I022');
  });

  it('特殊文字を含む userId もエンコードされる', () => {
    const url = buildIcebergPdcaUrl('user&id=1');
    expect(url).toContain('userId=user');
    expect(url).toMatch(/^\/analysis\/iceberg-pdca\?/);
  });

  it('source オプションを指定すると URL に含まれる', () => {
    expect(buildIcebergPdcaUrl('U001', { source: 'monitoring' })).toBe(
      '/analysis/iceberg-pdca?userId=U001&source=monitoring',
    );
  });

  it('source 未指定なら userId のみ（後方互換）', () => {
    expect(buildIcebergPdcaUrl('U001')).toBe('/analysis/iceberg-pdca?userId=U001');
  });
});

// ---------------------------------------------------------------------------
// buildSupportPlanMonitoringUrl — Iceberg → Monitoring 導線
// ---------------------------------------------------------------------------

describe('buildSupportPlanMonitoringUrl', () => {
  it('userId と tab=monitoring を query param に含める', () => {
    expect(buildSupportPlanMonitoringUrl('I022')).toBe(
      '/support-plan-guide?userId=I022&tab=monitoring',
    );
  });

  it('tab は必ず monitoring 固定', () => {
    const url = buildSupportPlanMonitoringUrl('U999');
    expect(url).toContain('tab=monitoring');
    expect(url).toContain('userId=U999');
  });
});
