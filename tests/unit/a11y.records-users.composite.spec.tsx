import RecordList from '@/features/records/RecordList';
import { UsersPanel } from '@/features/users';
import { ToastProvider } from '@/hooks/useToast';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import fs from 'node:fs';
import path from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const noop = async () => undefined;
const mockRecordsList = vi.fn();

vi.mock('@/features/users/store', () => {
  const sampleUsers = [
    {
      Id: 1,
      UserID: 'demo-user',
      FullName: 'デモ 利用者',
      AttendanceDays: ['Mon', 'Wed'],
      ServiceStartDate: '2024-01-01',
      ServiceEndDate: null,
      ContractDate: '2023-12-01',
      IsHighIntensitySupportTarget: false,
    },
  ];
  return {
    useUsersStore: () => ({
      data: sampleUsers,
      status: 'success',
      error: null,
      refresh: vi.fn(noop),
      create: vi.fn(noop),
      update: vi.fn(noop),
      remove: vi.fn(noop),
    }),
  };
});

vi.mock('@/features/records/api', () => ({
  useRecordsApi: () => ({
    list: mockRecordsList,
    add: vi.fn(noop),
  }),
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    isUsersCrudEnabled: () => true,
    shouldSkipLogin: () => false,
  };
});

vi.mock('@/lib/audit', () => ({
  pushAudit: vi.fn(),
}));

const shouldRun = process.env.CI !== 'true' || process.env.A11Y_COMPOSITE === '1';
const describeWithSkip = describe as typeof describe & { skip: typeof describe };
const suite = shouldRun ? describeWithSkip : describeWithSkip.skip;

suite('Composite accessibility smoke (records + users)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordsList.mockResolvedValue([
      {
        Id: 101,
        Title: 'デモ 利用者',
        cr013_recorddate: '2024-01-01',
        cr013_specialnote: '初期データ',
        cr013_amactivity: 'AM 活動',
        cr013_pmactivity: 'PM 活動',
        cr013_lunchamount: '完食',
        cr013_behaviorcheck: [],
      },
    ]);
  });

  it('has no detectable violations when RecordList and UsersPanel render together', async () => {
    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <div>
            <RecordList />
            <UsersPanel />
          </div>
        </ToastProvider>
      </MemoryRouter>
    );

    await screen.findByRole('table');

    const results = await axe(container);

    if (process.env.A11Y_AXE_JSON === '1') {
      const outDir = path.resolve('artifacts', 'axe');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, 'records-users-composite.json'),
        JSON.stringify(results, null, 2),
        'utf8'
      );
    }

    expect(results).toHaveNoViolations();
  });
});
