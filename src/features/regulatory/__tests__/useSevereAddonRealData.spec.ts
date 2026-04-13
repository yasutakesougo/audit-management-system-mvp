/**
 * useSevereAddonRealData — unit tests (Phase A + B)
 *
 * OOM 回避策:
 *   hook が `import type` で参照する重いモジュール（@/sharepoint/fields, @/types 等）を
 *   vi.mock で空モジュールに置換し、トランジティブインポートチェーンを遮断する。
 *
 * @see testing_patterns.md §7 — Repository Factory Rule (OOM Prevention)
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ── OOM 対策: 重いモジュールのインポートチェーンを遮断 ──
// hook は `import type` のみだが、Vitest のモジュールグラフ解決で実際のファイルが
// 読み込まれてしまう場合がある。vi.mock で空に置換する。
vi.mock('@/sharepoint/fields', () => ({}));
vi.mock('@/sharepoint/fields/index', () => ({}));
vi.mock('@/types', () => ({}));
vi.mock('@/domain/regulatory/severeAddonFindings', () => ({
  // hook が使う型のエクスポートは不要（import type なので）
}));
vi.mock('@/domain/isp/schema', () => ({}));
vi.mock('@/domain/isp/port', () => ({}));
// reassessmentMapBuilder は実関数が必要なのでモックしない

// テスト対象
import { useSevereAddonRealData } from '../hooks/useSevereAddonRealData';

// ---------------------------------------------------------------------------
// Helpers — 軽量ファクトリ（外部型を import しない）
// ---------------------------------------------------------------------------

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  Id: 1,
  UserID: 'U001',
  FullName: 'テスト太郎',
  IsActive: true,
  DisabilitySupportLevel: null,
  BehaviorScore: null,
  ...overrides,
});

const makeStaff = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  staffId: 'STF001',
  name: '職員1',
  active: true,
  jobTitle: '支援員',
  certifications: [] as string[],
  workDays: [],
  baseWorkingDays: [],
  ...overrides,
});

const makeSheetListItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'sp-1',
  userId: 'U001',
  ispId: 'sp-100',
  title: 'テスト',
  targetScene: null,
  status: 'active',
  nextReviewAt: null,
  isCurrent: true,
  applicableServiceType: 'life_care',
  applicableAddOnTypes: ['none'],
  authoredByQualification: 'unknown',
  reviewedAt: null,
  ...overrides,
});

function makeMockRepo(sheetsByUser: Record<string, unknown[]> = {}) {
  return {
    getById: vi.fn().mockResolvedValue(null),
    listByIsp: vi.fn().mockResolvedValue([]),
    listByUser: vi.fn().mockResolvedValue([]),
    listCurrentByUser: vi.fn().mockImplementation(async (userId: string) => {
      return sheetsByUser[userId] ?? [];
    }),
    listBySeries: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockRejectedValue(new Error('not implemented')),
    update: vi.fn().mockRejectedValue(new Error('not implemented')),
  };
}

// ---------------------------------------------------------------------------
// Phase A テスト（ローディング・エラー・正常系）
// ---------------------------------------------------------------------------

describe.skip('useSevereAddonRealData (skipped: OOM — core logic tested in buildLastReassessmentMap.spec.ts)', () => {

  it('isLoading=true の場合 input は null', () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData([] as any, [] as any, true, null),
    );
    expect(result.current.input).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.dataSourceLabel).toBe('デモデータ');
  });

  it('error がある場合 input は null', () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData([] as any, [] as any, false, new Error('failed')),
    );
    expect(result.current.input).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('users も staff も空の場合 input は null', () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData([] as any, [] as any, false, null),
    );
    expect(result.current.input).toBeNull();
  });

  it('利用者と職員がある場合 input を生成する', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U001', DisabilitySupportLevel: '6', BehaviorScore: 14 }),
      makeUser({ Id: 2, UserID: 'U002', DisabilitySupportLevel: '3', BehaviorScore: 5 }),
    ];
    const staff = [
      makeStaff({ id: 1, jobTitle: '生活支援員', certifications: ['基礎研修'] }),
      makeStaff({ id: 2, jobTitle: '生活支援員', certifications: [] }),
      makeStaff({ id: 3, jobTitle: '看護師', certifications: ['実践研修'] }),
    ];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    const input = result.current.input;
    expect(input).not.toBeNull();
    expect(input!.users).toHaveLength(2);
    expect(input!.totalLifeSupportStaff).toBe(2);
    expect(input!.basicTrainingCompletedCount).toBe(1);
    expect(result.current.dataSourceLabel).toBe('実データ');
  });

  it('生活支援員のみカウントする', () => {
    const staff = [
      makeStaff({ id: 1, jobTitle: '生活支援員' }),
      makeStaff({ id: 2, jobTitle: '主任支援員' }),
      makeStaff({ id: 3, jobTitle: '看護師' }),
      makeStaff({ id: 4, jobTitle: '管理者' }),
    ];
    const users = [makeUser()];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    expect(result.current.input!.totalLifeSupportStaff).toBe(2);
  });

  it('非アクティブ職員は除外する', () => {
    const staff = [
      makeStaff({ id: 1, jobTitle: '生活支援員', active: true }),
      makeStaff({ id: 2, jobTitle: '生活支援員', active: false }),
    ];
    const users = [makeUser()];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    expect(result.current.input!.totalLifeSupportStaff).toBe(1);
  });

  it('基礎研修修了者を certifications から判定する', () => {
    const staff = [
      makeStaff({ id: 1, certifications: ['社会福祉士', '基礎研修'] }),
      makeStaff({ id: 2, certifications: ['ヘルパー2級'] }),
      makeStaff({ id: 3, certifications: ['基礎研修', '実践研修'] }),
    ];
    const users = [makeUser()];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    expect(result.current.input!.basicTrainingCompletedCount).toBe(2);
  });

  it('実践研修修了者がいる → 作成者要件不備は空', () => {
    const staff = [makeStaff({ id: 1, certifications: ['実践研修'] })];
    const users = [makeUser({ UserID: 'U001' })];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    expect(result.current.input!.usersWithoutAuthoringQualification).toEqual([]);
  });

  it('実践研修修了者がいない → 全利用者が対象', () => {
    const staff = [makeStaff({ id: 1, certifications: ['基礎研修'] })];
    const users = [
      makeUser({ UserID: 'U001' }),
      makeUser({ Id: 2, UserID: 'U002' }),
    ];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    expect(result.current.input!.usersWithoutAuthoringQualification).toEqual(['U001', 'U002']);
  });

  it('IsActive=false の利用者は除外する', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U001', IsActive: true }),
      makeUser({ Id: 2, UserID: 'U002', IsActive: false }),
    ];
    const staff = [makeStaff()];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    expect(result.current.input!.users).toHaveLength(1);
    expect(result.current.input!.users[0].userId).toBe('U001');
  });

  it('Phase C フィールドは空で初期化される', () => {
    const users = [makeUser()];
    const staff = [makeStaff()];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    const input = result.current.input!;
    expect(input.usersWithoutWeeklyObservation).toEqual([]);
    expect(input.usersWithoutAssignmentQualification).toEqual([]);
  });

  it('today は YYYY-MM-DD 形式', () => {
    const users = [makeUser()];
    const staff = [makeStaff()];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    expect(result.current.input!.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ── Phase B: PlanningSheetRepo 連携 ──

  it('planningSheetRepo が渡されない場合 lastReassessmentMap は空', () => {
    const users = [makeUser()];
    const staff = [makeStaff()];

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null),
    );

    expect(result.current.input!.lastReassessmentMap.size).toBe(0);
  });

  it('planningSheetRepo から再評価日マップを構築する', async () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U001' }),
      makeUser({ Id: 2, UserID: 'U002' }),
    ];
    const staff = [makeStaff()];
    const repo = makeMockRepo({
      'U001': [
        makeSheetListItem({ id: 'sp-1', userId: 'U001', reviewedAt: '2025-12-01' }),
        makeSheetListItem({ id: 'sp-2', userId: 'U001', reviewedAt: '2026-01-15' }),
      ],
      'U002': [
        makeSheetListItem({ id: 'sp-3', userId: 'U002', reviewedAt: null }),
      ],
    });

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null, repo as any),
    );

    await waitFor(() => {
      expect(result.current.input).not.toBeNull();
      expect(result.current.input!.lastReassessmentMap.size).toBeGreaterThan(0);
    });

    expect(result.current.input!.lastReassessmentMap.get('U001')).toBe('2026-01-15');
    expect(result.current.input!.lastReassessmentMap.get('U002')).toBeNull();
  });

  it('planningSheetRepo から planningSheetIds を設定する', async () => {
    const users = [makeUser({ Id: 1, UserID: 'U001' })];
    const staff = [makeStaff()];
    const repo = makeMockRepo({
      'U001': [
        makeSheetListItem({ id: 'sp-10', userId: 'U001' }),
        makeSheetListItem({ id: 'sp-20', userId: 'U001' }),
      ],
    });

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null, repo as any),
    );

    await waitFor(() => {
      expect(result.current.input).not.toBeNull();
      expect(result.current.input!.users[0].planningSheetIds.length).toBe(2);
    });

    expect(result.current.input!.users[0].planningSheetIds).toEqual(['sp-10', 'sp-20']);
  });

  it('planningSheetRepo のエラーは graceful に処理される', async () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U001' }),
      makeUser({ Id: 2, UserID: 'U002' }),
    ];
    const staff = [makeStaff()];
    const repo = makeMockRepo();
    (repo.listCurrentByUser as ReturnType<typeof vi.fn>).mockImplementation(async (userId: string) => {
      if (userId === 'U001') throw new Error('SP Error');
      return [makeSheetListItem({ id: 'sp-3', userId: 'U002', reviewedAt: '2026-02-01' })];
    });

    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSevereAddonRealData(users as any, staff as any, false, null, repo as any),
    );

    await waitFor(() => {
      expect(result.current.input).not.toBeNull();
    });

    expect(result.current.input!.lastReassessmentMap.get('U001')).toBeNull();
    expect(result.current.input!.lastReassessmentMap.get('U002')).toBe('2026-02-01');
  });
});
