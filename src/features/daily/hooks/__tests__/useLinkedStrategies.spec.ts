/**
 * useLinkedStrategies.spec — 参照戦略 hook のテスト
 */
import { renderHook } from '@testing-library/react';
import { useLinkedStrategies } from '../useLinkedStrategies';

const LS_KEY = 'planningSheet.versions.v1';

function makePlanningSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ps-001',
    userId: 'U-001',
    ispId: 'isp-001',
    title: '支援計画テスト',
    status: 'active',
    isCurrent: true,
    version: 1,
    planning: {
      supportPriorities: ['課題A'],
      antecedentStrategies: ['見通しカード提示', '環境調整'],
      teachingStrategies: ['深呼吸の練習'],
      consequenceStrategies: ['即座に称賛', '選択肢の提示'],
      procedureSteps: [],
      crisisThresholds: null,
      restraintPolicy: 'prohibited_except_emergency',
      reviewCycleDays: 180,
    },
    ...overrides,
  };
}

describe('useLinkedStrategies', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('userId がない場合は空を返す', () => {
    const { result } = renderHook(() => useLinkedStrategies(undefined));
    expect(result.current.hasSheet).toBe(false);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.antecedent).toEqual([]);
  });

  it('active シートがない場合は空を返す', () => {
    localStorage.setItem(LS_KEY, JSON.stringify([
      makePlanningSheet({ status: 'draft' }),
    ]));
    const { result } = renderHook(() => useLinkedStrategies('U-001'));
    expect(result.current.hasSheet).toBe(false);
  });

  it('active + isCurrent のシートから戦略テキストを取得する', () => {
    localStorage.setItem(LS_KEY, JSON.stringify([makePlanningSheet()]));
    const { result } = renderHook(() => useLinkedStrategies('U-001'));
    expect(result.current.hasSheet).toBe(true);
    expect(result.current.antecedent).toEqual(['見通しカード提示', '環境調整']);
    expect(result.current.teaching).toEqual(['深呼吸の練習']);
    expect(result.current.consequence).toEqual(['即座に称賛', '選択肢の提示']);
    expect(result.current.priorities).toEqual(['課題A']);
    expect(result.current.totalCount).toBe(5);
    expect(result.current.sheetId).toBe('ps-001');
    expect(result.current.sheetTitle).toBe('支援計画テスト');
  });

  it('別ユーザーのシートは取得しない', () => {
    localStorage.setItem(LS_KEY, JSON.stringify([makePlanningSheet()]));
    const { result } = renderHook(() => useLinkedStrategies('U-999'));
    expect(result.current.hasSheet).toBe(false);
  });

  it('最大3件に絞られる', () => {
    const many = makePlanningSheet({
      planning: {
        supportPriorities: [],
        antecedentStrategies: ['a', 'b', 'c', 'd', 'e'],
        teachingStrategies: [],
        consequenceStrategies: [],
        procedureSteps: [],
        crisisThresholds: null,
        restraintPolicy: 'prohibited_except_emergency',
        reviewCycleDays: 180,
      },
    });
    localStorage.setItem(LS_KEY, JSON.stringify([many]));
    const { result } = renderHook(() => useLinkedStrategies('U-001'));
    expect(result.current.antecedent).toHaveLength(3);
    // totalCount は元の5件のまま
    expect(result.current.totalCount).toBe(5);
  });

  it('複数バージョンのうち最新を選ぶ', () => {
    localStorage.setItem(LS_KEY, JSON.stringify([
      makePlanningSheet({ version: 1, planning: { ...makePlanningSheet().planning, antecedentStrategies: ['旧'] } }),
      makePlanningSheet({ version: 2, planning: { ...makePlanningSheet().planning, antecedentStrategies: ['新'] } }),
    ]));
    const { result } = renderHook(() => useLinkedStrategies('U-001'));
    expect(result.current.antecedent).toEqual(['新']);
  });

  it('isCurrent = false のシートは無視する', () => {
    localStorage.setItem(LS_KEY, JSON.stringify([
      makePlanningSheet({ isCurrent: false }),
    ]));
    const { result } = renderHook(() => useLinkedStrategies('U-001'));
    expect(result.current.hasSheet).toBe(false);
  });

  it('localStorage が壊れていてもクラッシュしない', () => {
    localStorage.setItem(LS_KEY, 'not valid json');
    const { result } = renderHook(() => useLinkedStrategies('U-001'));
    expect(result.current.hasSheet).toBe(false);
  });
});
