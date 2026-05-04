import { expect, type Page } from '@playwright/test';
import { setupSharePointStubs } from '../_helpers/setupSharePointStubs';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

type MockUser = {
  Id: number;
  UserID: string;
  FullName: string;
  IsHighIntensitySupportTarget?: boolean;
};

type MockDailyRecord = {
  Id: number;
  Title: string;
  cr013_date: string;
  cr013_payload: string;
  cr013_kind: string;
  cr013_personId: string;
  cr013_status: string;
};

const mockUsers: MockUser[] = Array.from({ length: 12 }).map((_, index) => ({
  Id: index + 1,
  UserID: `U-${String(index + 1).padStart(3, '0')}`,
  FullName: ['田中 太郎', '佐藤 花子', '鈴木 次郎', '高橋 美咲', '山田 健一', '渡辺 由美', '伊藤 雄介', '中村 恵子', '小林 智子', '加藤 秀樹', '吉田 京子', '清水 達也'][index % 12],
  IsHighIntensitySupportTarget: true,
}));
const getLocalDateISO = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const mockDailyRecords: MockDailyRecord[] = mockUsers.map((user, index) => ({
  Id: index + 101,
  Title: getLocalDateISO(),
  cr013_date: getLocalDateISO(),
  cr013_payload: JSON.stringify({
    amActivities: ['午前活動'],
    pmActivities: ['午後活動'],
    mealAmount: '完食',
    specialNotes: index % 2 === 0 ? '特記事項あり' : '',
  }),
  cr013_kind: 'A',
  cr013_personId: user.UserID,
  cr013_status: index >= 6 ? '未作成' : '完了',
}));

const readHudSpans = async (page: Page) =>
  page.evaluate(() => {
    const win = window as typeof window & {
      __PREFETCH_HUD__?: { spans?: Array<{ key?: string; source?: string; meta?: Record<string, unknown> }> };
    };
    return (win.__PREFETCH_HUD__?.spans ?? []).map((span) => ({
      key: span?.key ?? '',
      source: span?.source ?? '',
      meta: span?.meta ?? {},
    }));
  });

export async function primeOpsEnv(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as typeof window & { __ENV__?: Record<string, string> };
    win.__ENV__ = {
      ...(win.__ENV__ ?? {}),
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '1',
      VITE_DEMO_MODE: '0',
      VITE_WRITE_ENABLED: '1',
      VITE_PREFETCH_HUD: '1',
      VITE_FEATURE_SCHEDULES: '1',
      MODE: 'production',
      DEV: '0',
      VITE_SP_RESOURCE: win.__ENV__?.VITE_SP_RESOURCE ?? 'https://contoso.sharepoint.com',
      VITE_SP_SITE_RELATIVE: win.__ENV__?.VITE_SP_SITE_RELATIVE ?? '/sites/Operations',
      VITE_SP_SCOPE_DEFAULT: win.__ENV__?.VITE_SP_SCOPE_DEFAULT ?? 'https://contoso.sharepoint.com/AllSites.Read',
    };

    try {
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('writeEnabled', '1');
      window.localStorage.setItem('feature:schedules', '1');
      window.localStorage.setItem('VITE_PREFETCH_HUD', '1');
    } catch {
      /* noop */
    }

    try {
      window.sessionStorage.setItem('spToken', 'mock-live-token');
    } catch {
      /* noop */
    }
  });

  await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('https://graph.microsoft.com/**', (route) =>
    route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify({ value: [] }) }),
  );

  page.on('console', (_msg) => {
    // browser logging disabled for strict pre-push lint
  });

  await setupSharePointStubs(page, {
    debug: true,
    currentUser: { status: 200, body: { Id: 12345, Title: 'Mock User' } },
    lists: [
      {
        name: 'Users_Master',
        items: mockUsers,
        // Cast items to the concrete type to satisfy ListStubConfig
        fields: [
          { InternalName: 'Id' },
          { InternalName: 'Title' },
          { InternalName: 'UserID' },
          { InternalName: 'FullName' },
          { InternalName: 'UsageStatus' },
          { InternalName: 'IsHighIntensitySupportTarget' },
        ],
        sort: (items) => [...(items as MockUser[])].sort((a, b) => a.UserID.localeCompare(b.UserID)),
      },
      {
        name: 'SupportRecord_Daily',
        items: (() => {
          // Group by date to create canonical items
          const byDate: Record<string, {
            Id: number;
            Title: string;
            RecordDate: string;
            ReporterName: string;
            ReporterRole: string;
            UserCount: number;
            rows: Record<string, unknown>[];
          }> = {};
          mockDailyRecords.forEach(r => {
            if (!byDate[r.cr013_date]) {
              byDate[r.cr013_date] = {
                Id: r.Id + 2000, // Unique ID for parent
                Title: r.cr013_date,
                RecordDate: r.cr013_date,
                ReporterName: 'Mock Staff',
                ReporterRole: 'Staff',
                UserCount: 0,
                rows: []
              };
            }
            const payload = JSON.parse(r.cr013_payload);
            byDate[r.cr013_date].rows.push({
              userId: r.cr013_personId,
              userName: mockUsers.find(u => u.UserID === r.cr013_personId)?.FullName ?? '',
              status: r.cr013_status,
              amActivity: payload.amActivities?.[0] ?? '',
              pmActivity: payload.pmActivities?.[0] ?? '',
              lunchAmount: payload.mealAmount ?? '',
              specialNotes: payload.specialNotes ?? '',
              problemBehavior: {
                selfHarm: false,
                otherInjury: false,
                loudVoice: false,
                pica: false,
                other: false
              },
              behaviorTags: []
            });
            byDate[r.cr013_date].UserCount++;
          });
          return Object.values(byDate).map(item => ({
            ...item,
            UserRowsJSON: JSON.stringify(item.rows)
          }));
        })(),
        fields: [
          { InternalName: 'Id' },
          { InternalName: 'Title' },
          { InternalName: 'RecordDate' },
          { InternalName: 'ReporterName' },
          { InternalName: 'ReporterRole' },
          { InternalName: 'UserRowsJSON' },
          { InternalName: 'UserCount' },
        ],
        insertPosition: 'start',
        sort: (items) => [...(items as Record<string, unknown>[])].sort((a, b) => (Number(b.Id) || 0) - (Number(a.Id) || 0)),
      },
      {
        name: 'SupportPlanningSheet_Master',
        items: [
          {
            Id: 1001,
            Title: '支援計画 U-001',
            UserCode: 'U-001',
            ISPId: '1',
            Status: 'active',
            IsCurrent: true,
            SupportPolicy: '対応方針テスト',
            ConcreteApproaches: '関わり方の具体策テスト',
            EnvironmentalAdjustments: '環境調整テスト',
            FormDataJson: JSON.stringify({
              title: '支援計画 U-001',
              observationFacts: '行動観察テスト',
              interpretationHypothesis: '分析・仮説テスト',
              supportIssues: '支援課題テスト',
            }),
            PlanningJson: JSON.stringify({
              procedureSteps: []
            })
          },
          {
            Id: 1007,
            Title: '支援計画 U-007',
            UserCode: 'U-007',
            ISPId: '7',
            Status: 'active',
            IsCurrent: true,
            SupportPolicy: '伊藤さんの対応方針',
            ConcreteApproaches: '伊藤さんの具体策',
            EnvironmentalAdjustments: '伊藤さんの環境調整',
            FormDataJson: JSON.stringify({
              title: '支援計画 U-007',
              observationFacts: '伊藤さんの行動観察',
              interpretationHypothesis: '伊藤さんの分析',
              supportIssues: '伊藤さんの課題',
            }),
            PlanningJson: JSON.stringify({
              procedureSteps: []
            })
          }
        ],
        fields: [
          { InternalName: 'Id' },
          { InternalName: 'Title' },
          { InternalName: 'UserCode' },
          { InternalName: 'ISPId' },
          { InternalName: 'Status' },
          { InternalName: 'IsCurrent' },
          { InternalName: 'SupportPolicy' },
          { InternalName: 'ConcreteApproaches' },
          { InternalName: 'EnvironmentalAdjustments' },
          { InternalName: 'FormDataJson' },
          { InternalName: 'PlanningJson' },
        ],
      },
      { 
        name: 'MonitoringMeetings', 
        fields: [
          { InternalName: 'cr014_recordId' },
          { InternalName: 'cr014_userId' },
          { InternalName: 'cr014_meetingDate' },
          { InternalName: 'cr014_status' }
        ],
        items: [] 
      },
      {
        name: 'ISP_Master',
        items: [
          { Id: 1, UserCode: 'U-001', Status: '運用中', CreatedAt: '2026-05-01' },
          { Id: 7, UserCode: 'U-007', Status: '運用中', CreatedAt: '2026-05-01' },
        ],
        fields: [
          { InternalName: 'Id' },
          { InternalName: 'Title' },
          { InternalName: 'UserCode' },
          { InternalName: 'PlanStartDate' },
          { InternalName: 'Status' },
          { InternalName: 'IsCurrent' },
          { InternalName: 'VersionNo' },
        ],
      },
      {
        name: 'Staff_Master',
        items: [],
        fields: [
          { InternalName: 'Id' },
          { InternalName: 'Title' },
          { InternalName: 'StaffID' },
          { InternalName: 'FullName' },
        ],
      },
      { name: 'PlanPatches', items: [] },
      { name: 'Schedules', items: [] },
      { name: 'Approval_Logs', items: [] },
      { 
        name: 'SupportProcedureRecord_Daily', 
        items: mockDailyRecords.map(record => ({
            Id: record.Id,
            Title: record.Title,
            UserCode: record.cr013_personId,
            PlanningSheetId: record.cr013_personId === 'U-001' ? '1001' : (record.cr013_personId === 'U-007' ? '1007' : ''),
            RecordDate: record.cr013_date,
            TimeSlot: '',
            Activity: '',
            ProcedureText: '',
            ExecutionStatus: record.cr013_status === '完了' ? 'done' : 'planned',
            UserResponse: '',
            SpecialNotes: '',
            PerformedBy: 'Mock Staff',
            PerformedAt: new Date().toISOString(),
        })),
        fields: [
          { InternalName: 'Id' },
          { InternalName: 'Title' },
          { InternalName: 'UserCode' },
          { InternalName: 'PlanningSheetId' },
          { InternalName: 'RecordDate' },
          { InternalName: 'TimeSlot' },
          { InternalName: 'Activity' },
          { InternalName: 'ProcedureText' },
          { InternalName: 'ExecutionStatus' },
          { InternalName: 'UserResponse' },
          { InternalName: 'SpecialNotes' },
          { InternalName: 'PerformedBy' },
          { InternalName: 'PerformedAt' },
        ],
      },
      {
        name: 'SupportProcedure_Results',
        items: [],
        fields: [
          { InternalName: 'Id' },
          { InternalName: 'ParentScheduleId' },
          { InternalName: 'ResultDate' },
          { InternalName: 'ResultStatus' },
        ],
      },
      { name: 'User_Feature_Flags', items: [] },
      { name: 'BehaviorMonitoringRecord_Master', items: [] },
    ],
    fallback: { status: 200, body: { value: [] } },
  });
}

export async function waitForHudAny(page: Page, matchers: string[], options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 10_000;
  const needles = matchers.map((item) => item.toLowerCase());

  await expect
    .poll(async () => {
      const spans = await readHudSpans(page);
      for (const span of spans) {
        const haystack = [span.key, span.source, ...Object.values(span.meta ?? {})
          .filter((value): value is string => typeof value === 'string')]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        const matched = needles.every((needle) => haystack.some((value) => value.includes(needle)));
        if (matched) {
          return true as const;
        }
      }
      return false as const;
    }, { timeout })
    .toBe(true);
}

export async function gotoAndAssertH1(
  page: Page,
  path: string,
  heading: string | RegExp,
  hudMatchers?: string[],
): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible({ timeout: 15_000 });

  if (hudMatchers && hudMatchers.length > 0) {
    await waitForHudAny(page, hudMatchers);
  }
}
