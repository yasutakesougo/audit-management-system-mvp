import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useOperationHubData } from '@/features/operation-hub/useOperationHubData';

// ---- 固定時刻 & TZ 周り ----
vi.mock('@/utils/getNow', () => ({
  getNow: () => new Date('2025-03-10T00:00:00.000Z'), // 月曜想定
}));

// tz フォーマッタは最低限のパターンだけダミー実装
vi.mock('@/lib/tz', () => ({
  formatInTimeZone: (d: Date, _tz: string, fmt: string) => {
    const iso = new Date(d).toISOString();
    if (fmt === 'yyyy-MM-dd') return iso.slice(0, 10);
    if (fmt === 'yyyy年M月d日 (EEE)') return '2025年3月10日 (月)';
    if (fmt === 'M月d日') return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
    return iso;
  },
}));

// ---- SP クライアント/コアリスト作成の副作用は呼び出しだけ確認 ----
const ensureSpy = vi.fn(async () => {});
vi.mock('@/features/operation-hub/ensureCoreLists', () => ({
  useEnsureOperationHubLists: () => {},
  ensureOperationHubLists: () => ensureSpy(),
}));

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({}),
}));

// ---- ストア系：シナリオ毎に差し替えられるように工場関数化 ----
type Sched = Partial<import('@/lib/mappers').Schedule>;
type Staff = Partial<import('@/types').Staff>;
type User = Partial<import('@/types').User>;

type StoreShape<T> = {
  data: T[];
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
};

const stores: {
  schedules: StoreShape<Sched>;
  users: StoreShape<User>;
  staff: StoreShape<Staff>;
} = {
  schedules: { data: [], loading: false, error: null, reload: vi.fn(async () => {}) },
  users: { data: [], loading: false, error: null, reload: vi.fn(async () => {}) },
  staff: { data: [], loading: false, error: null, reload: vi.fn(async () => {}) },
};

const mockStores = (p?: {
  schedules?: Partial<(typeof stores)['schedules']>;
  users?: Partial<(typeof stores)['users']>;
  staff?: Partial<(typeof stores)['staff']>;
}) => {
  Object.assign(stores.schedules, { data: [], loading: false, error: null, reload: vi.fn(async () => {}) }, p?.schedules);
  Object.assign(stores.users, { data: [], loading: false, error: null, reload: vi.fn(async () => {}) }, p?.users);
  Object.assign(stores.staff, { data: [], loading: false, error: null, reload: vi.fn(async () => {}) }, p?.staff);
};

vi.mock('@/stores/useSchedules', () => ({
  useSchedules: () => stores.schedules,
}));
vi.mock('@/stores/useUsers', () => ({
  useUsers: () => stores.users,
}));
vi.mock('@/stores/useStaff', () => ({
  useStaff: () => stores.staff,
}));

// ---- テスト用コンポーネント（hook の出力をDOMに描画） ----
const Probe: React.FC = () => {
  const data = useOperationHubData();
  return (
    <div>
      <div data-testid="loading">{String(data.loading)}</div>
      <div data-testid="ready">{String(data.ready)}</div>
      <div data-testid="dateISO">{data.dateISO}</div>
      <div data-testid="kpi0">{data.kpis[0]?.value}-{data.kpis[0]?.tone}</div>
      <div data-testid="alerts">{data.alerts.map((a) => a.tone).join(',')}</div>
      <div data-testid="mobile">{data.mobileTasks.map((t) => t.status).join(',')}</div>
      <div data-testid="unassigned">{String(data.unassignedSchedules.length)}</div>
      <button onClick={data.refresh}>refresh</button>
      <div data-testid="timeline">{data.timeline ? `${data.timeline.resources.length}:${data.timeline.slotMinutes}` : 'null'}</div>
    </div>
  );
};

const renderProbe = () => render(<Probe />);

// ---- ヘルパ：UTC ISO を簡単に作る ----
const iso = (s: string) => new Date(s).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  ensureSpy.mockClear();
  mockStores();
});

afterEach(() => {
  cleanup();
});

describe('useOperationHubData – full branches', () => {
  it('loading/ready と 既定日付ラベル/ISO', () => {
    mockStores({
      schedules: { loading: true },
      users: { loading: false },
      staff: { loading: false },
    });

    renderProbe();
  expect(screen.getByTestId('loading').textContent).toBe('true');
  expect(screen.getByTestId('ready').textContent).toBe('true');
    expect(screen.getByTestId('dateISO').textContent).toBe('2025-03-10');
  });

  it('KPI トーン (success/info/error) と 未割当/承認待ち抽出、タイムライン/コンフリクト', () => {
    const staff = [
      { id: 1, name: '佐藤', role: '常勤' },
      { id: 2, name: '鈴木', role: '非常勤' },
      { id: 3, name: '田中', role: '施設長' },
    ] as Staff[];

    const baseDay = '2025-03-10';
    const S = (h: number, m = 0) => iso(`${baseDay}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);

    const schedules: Sched[] = [
      { id: 101, category: 'Org', title: '会議', staffId: 3, startUtc: S(0), endUtc: S(9) },
      { id: 102, category: 'User', title: '訪問', staffId: 1, startUtc: S(0), endUtc: S(3) },
      { id: 103, category: 'User', title: '同行', staffId: 1, startUtc: S(2, 30), endUtc: S(4) },
      { id: 104, category: 'User', title: '面談', staffNames: ['鈴木'], startUtc: S(1), endUtc: S(2) },
      { id: 105, category: 'User', title: '送迎', status: 'submitted', startUtc: S(6), endUtc: S(7) },
    ];

    mockStores({
      schedules: { data: schedules },
      users: { data: [] },
      staff: { data: staff },
    });

    renderProbe();

    const tl = screen.getByTestId('timeline').textContent ?? '';
    const resourceCount = Number(tl.split(':')[0]);
    expect(resourceCount).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('unassigned').textContent).toBe('1');

    const kpi = screen.getByTestId('kpi0').textContent ?? '';
    expect(kpi).toMatch(/%-error$/);

    expect(screen.getByTestId('mobile').textContent).toContain('pending');
  });

  it('アラート：利用者 <=7日=error / <=30日=warning、職員資格/役割未入力で warning or info', () => {
    const users: User[] = [
      { id: 10, userId: '10', name: 'U1', certExpiry: '2025-03-15' },
      { id: 11, userId: '11', name: 'U2', certExpiry: '2025-04-05' },
    ];
    const staff: Staff[] = [
      { id: 1, name: '佐藤', certifications: ['要更新: 2025/03'], role: '常勤' },
      { id: 2, name: '鈴木', certifications: [], role: '' },
    ];

    mockStores({
      schedules: { data: [] },
      users: { data: users },
      staff: { data: staff },
    });

    renderProbe();
    const tones = screen.getByTestId('alerts').textContent ?? '';
    expect(tones).toContain('error');
    expect(tones).toContain('warning');
  });

  it('モバイルタスク：completed / alert / pending と actions（緊急連絡）', () => {
    const base = '2025-03-10';
    const S = (h: number, m = 0) => iso(`${base}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);

    const schedules: Sched[] = [
      {
        id: 201,
        title: '完了',
        startUtc: iso('2025-03-09T23:00:00Z'),
        endUtc: iso('2025-03-09T23:30:00Z'),
        startDate: '2025-03-10',
        endDate: '2025-03-10',
      },
      {
        id: 202,
        title: 'まもなく',
        startUtc: iso('2025-03-10T00:15:00Z'),
        endUtc: S(1),
        startDate: '2025-03-10',
        endDate: '2025-03-10',
      },
      {
        id: 203,
        title: 'のちほど',
        startUtc: S(5),
        endUtc: S(6),
        startDate: '2025-03-10',
        endDate: '2025-03-10',
      },
    ];
    mockStores({
      schedules: { data: schedules },
      users: { data: [] },
      staff: { data: [] },
    });

    renderProbe();
    const statuses = screen.getByTestId('mobile').textContent ?? '';
    expect(statuses).toBe('completed,alert,pending');
  });

  it('refresh：ensure + 3 reload を実行', async () => {
    const r1 = vi.fn(async () => {});
    const r2 = vi.fn(async () => {});
    const r3 = vi.fn(async () => {});
    mockStores({
      schedules: { reload: r1 },
      users: { reload: r2 },
      staff: { reload: r3 },
    });

    renderProbe();
    await act(async () => {
      screen.getByRole('button', { name: 'refresh' }).click();
      await Promise.resolve();
    });

    expect(ensureSpy).toHaveBeenCalledTimes(1);
    expect(r1).toHaveBeenCalled();
    expect(r2).toHaveBeenCalled();
    expect(r3).toHaveBeenCalled();
  });

  it('タイムライン無しケース：予定が空なら null を返す', () => {
    mockStores({
      schedules: { data: [] },
      users: { data: [] },
      staff: { data: [] },
    });
    renderProbe();
    expect(screen.getByTestId('timeline').textContent).toBe('null');
  });
});

// 走らせ方
// npx vitest run tests/unit/operation-hub.useOperationHubData.full.spec.tsx
// npm run test:coverage
