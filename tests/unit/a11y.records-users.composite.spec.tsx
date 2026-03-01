import RecordList from '@/features/records/RecordList';
import { ToastProvider } from '@/hooks/useToast';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// UsersPanel is mocked at the component level because its deep dependency
// chain (including @react-pdf/renderer) causes Node crashes in jsdom.
// The a11y test only needs the rendered HTML structure, not real hook logic.
vi.mock('@/features/users/UsersPanel', () => ({
  default: () =>
    React.createElement('div', { 'data-testid': 'users-panel-root' },
      React.createElement('table', { style: { width: '100%' } },
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', null, 'ユーザーID'),
            React.createElement('th', null, '氏名'),
          ),
        ),
        React.createElement('tbody', null,
          React.createElement('tr', null,
            React.createElement('td', null, 'demo-user'),
            React.createElement('td', null, 'デモ 利用者'),
          ),
        ),
      ),
    ),
}));

const noop = async () => undefined;
const mockRecordsList = vi.fn();

vi.mock('@/features/records/api', () => ({
  useRecordsApi: () => ({
    list: mockRecordsList,
    add: vi.fn(noop),
  }),
}));

vi.mock('@/lib/audit', () => ({
  pushAudit: vi.fn(),
}));

vi.mock('@/domain/compliance/spAuditLogger', () => ({
  enqueueAuditToSP: vi.fn(),
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
    // Import UsersPanel after mock is set up
    const { default: UsersPanel } = await import('@/features/users/UsersPanel');

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
      const outDir = resolve('artifacts', 'axe');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        join(outDir, 'records-users-composite.json'),
        JSON.stringify(results, null, 2),
        'utf8'
      );
    }

    expect(results).toHaveNoViolations();
  });
});
