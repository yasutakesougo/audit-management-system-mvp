import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import PhonelinkRoundedIcon from '@mui/icons-material/PhonelinkRounded';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import { isDemoModeEnabled } from '@/lib/env';
import { useUsers } from '@/stores/useUsers';
import { useStaff } from '@/stores/useStaff';
import { useSchedulesToday } from '@/features/schedule/useSchedulesToday';
import { useFeatureFlags } from '@/config/featureFlags';

type SectionCardProps = {
  title: string;
  to?: string;
  children: ReactNode;
};

const SectionCard = ({ title, to, children }: SectionCardProps) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {to ? (
        <Button component={Link} to={to} size="small" variant="outlined">すべて見る</Button>
      ) : null}
    </div>
    {children}
  </div>
);

export default function Home() {
  const demoModeEnabled = isDemoModeEnabled();
  const { schedules: schedulesEnabled } = useFeatureFlags();
  const { data: users } = useUsers();
  const { data: staff } = useStaff();
  const {
    data: schedules,
    loading: schedulesLoading,
    error: schedulesError,
    dateISO,
    source: schedulesSource,
    fallbackKind: schedulesFallbackKind,
    fallbackError: schedulesFallbackError,
  } = useSchedulesToday(5);

  const sourceChipLabel = schedulesSource === 'sharepoint' ? 'SharePoint' : 'Demo';
  const sourceChipColor: 'success' | 'error' | 'info' = schedulesSource === 'sharepoint'
    ? 'success'
    : schedulesFallbackError
      ? 'error'
      : 'info';
  const fallbackKindLabel = schedulesFallbackKind
    ? {
        auth: '認証・同意が必要',
        network: 'ネットワーク障害',
        schema: 'スキーマ不整合',
        unknown: '不明なエラー',
      }[schedulesFallbackKind]
    : null;

  const tiles = [
    { to: '/users', label: '利用者マスタ', caption: '利用者情報を閲覧・管理', Icon: PeopleAltRoundedIcon, accent: 'text-blue-600 bg-blue-100', border: 'border-blue-200 hover:border-blue-300 hover:bg-blue-50' },
  { to: '/dashboard', label: 'オペレーションハブ', caption: '施設全体の運営状況を俯瞰', Icon: DashboardRoundedIcon, accent: 'text-green-600 bg-green-100', border: 'border-green-200 hover:border-green-300 hover:bg-green-50' },
    { to: '/schedule', label: 'スケジュール', caption: '今日の予定をチェック', Icon: EventAvailableRoundedIcon, accent: 'text-purple-600 bg-purple-100', border: 'border-purple-200 hover:border-purple-300 hover:bg-purple-50' },
    { to: '/tablet-demo', label: 'モバイル予定ビュー', caption: 'スマホ向けの簡易ビュー', Icon: PhonelinkRoundedIcon, accent: 'text-amber-600 bg-amber-100', border: 'border-amber-200 hover:border-amber-300 hover:bg-amber-50' },
    { to: '/daily', label: '日次記録', caption: '今日の記録入力を開始', Icon: AssignmentTurnedInRoundedIcon, accent: 'text-sky-600 bg-sky-100', border: 'border-sky-200 hover:border-sky-300 hover:bg-sky-50' },
    { to: '/checklist', label: '自己点検チェックリスト', caption: '監査前チェックを実施', Icon: ChecklistRoundedIcon, accent: 'text-gray-600 bg-gray-100', border: 'border-gray-200 hover:border-gray-300 hover:bg-gray-50' },
  ] as const;

  const userItems = users ?? [];
  const staffItems = staff ?? [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="space-y-2" aria-labelledby="home-heading">
        <h1 id="home-heading" className="text-3xl font-bold">Audit Management – ホーム</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${demoModeEnabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            <span className="inline-block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {demoModeEnabled ? 'デモモードが有効です' : '本番モード（MSAL 認証あり）'}
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="主要機能">
        {tiles
          .filter((tile) => schedulesEnabled || tile.to !== '/schedule')
          .map(({ to, label, caption, Icon, accent, border }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex h-full flex-col justify-between rounded-xl border bg-white p-4 shadow transition ${border} ` +
              `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ` +
              (isActive ? 'ring-2 ring-blue-300' : '')
            }
            aria-label={`${label}へ移動`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition group-hover:scale-105 ${accent}`} aria-hidden="true">
                <Icon fontSize="inherit" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
                <p className="text-sm text-gray-600">{caption}</p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:underline">
              詳細を開く <span aria-hidden="true">→</span>
            </span>
          </NavLink>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="最新情報">
        {schedulesEnabled ? (
          <SectionCard title={`今日の予定（${dateISO}）`} to="/schedule">
          <div className="min-h-[120px]">
            <div id="schedule-source" className="mb-3 flex items-center justify-between gap-3 text-xs text-gray-600">
              <Chip size="small" color={sourceChipColor} variant="outlined" label={`データソース: ${sourceChipLabel}`} />
              {fallbackKindLabel ? <span className="text-xs text-gray-500">原因: {fallbackKindLabel}</span> : null}
            </div>
            {schedulesSource === 'demo' && schedulesFallbackError ? (
              <div
                role="alert"
                className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"
              >
                SharePoint 連携に失敗したため、予定はデモデータです（保存されていません）。
              </div>
            ) : null}
            {schedulesLoading ? (
              <div className="space-y-2" aria-hidden="true" aria-busy="true">
                <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                <div className="h-6 w-36 animate-pulse rounded bg-gray-200" />
              </div>
            ) : schedulesError ? (
              <div className="text-sm text-red-600">予定の読み込みに失敗しました</div>
            ) : schedules.length ? (
              <ul className="space-y-2" aria-describedby="schedule-source">
                {schedules.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-gray-900" title={item.title || ''}>{item.title}</div>
                      <div className="text-xs text-gray-600">{item.startText}</div>
                    </div>
                    <div className="shrink-0">
                      {item.allDay ? (
                        <Chip size="small" variant="outlined" color="info" label="終日" />
                      ) : item.status ? (
                        <Chip size="small" variant="outlined" label={item.status} />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-600">本日の予定はありません</div>
            )}
          </div>
        </SectionCard>
        ) : null}

        <SectionCard title="利用者（最近の更新）" to="/users">
          {userItems.length ? (
            <ul className="space-y-2">
              {userItems.slice(0, 5).map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-gray-900">{user.name || '氏名未設定'}</div>
                    <div className="truncate text-xs text-gray-600">#{user.userId} / {user.furigana || user.nameKana || 'ふりがな未登録'}</div>
                  </div>
                  <Chip
                    size="small"
                    color={user.active !== false ? 'success' : 'default'}
                    variant={user.active !== false ? 'filled' : 'outlined'}
                    label={user.active !== false ? '在籍' : '退所'}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">データがありません</div>
          )}
        </SectionCard>

        <SectionCard title="職員（最近の更新）" to="/staff">
          {staffItems.length ? (
            <ul className="space-y-2">
              {staffItems.slice(0, 5).map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-gray-900">{member.name}</div>
                    <div className="truncate text-xs text-gray-600">{member.role || '役割未設定'}</div>
                  </div>
                  <Chip
                    size="small"
                    color={member.active !== false ? 'success' : 'default'}
                    variant={member.active !== false ? 'filled' : 'outlined'}
                    label={member.active !== false ? '在籍' : '退職'}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">データがありません</div>
          )}
        </SectionCard>
      </section>
    </main>
  );
}
