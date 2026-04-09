/**
 * DailyPageTableView — Table-mode rendering for daily records
 *
 * Extracted from DailyPage.tsx for single-responsibility.
 */

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { Link } from 'react-router-dom';
import { dateOnly, STATUS_COLOR, STATUS_LABEL } from './dailyPageConstants';

// ─── StatusChip ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status?: string | null }) {
  const key = (status ?? '').toLowerCase();
  const normalized = key || 'draft';
  const color = STATUS_COLOR[normalized] ?? 'default';
  const label = STATUS_LABEL[normalized] ?? '未指定';
  return <Chip size="small" color={color} variant="outlined" label={label} />;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface DailyRow {
  id: number;
  title?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  notes?: string | null;
  mealLog?: string | null;
  status?: string | null;
  modified?: string | null;
  staffId?: string | number | null;
  userId?: string | number | null;
}

interface DailyPageTableViewProps {
  rows: DailyRow[];
  staffNameMap: Map<number, string>;
  userNameMap: Map<number, string>;
  compact: boolean;
  staffLoading: boolean;
  usersLoading: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DailyPageTableView({
  rows,
  staffNameMap,
  userNameMap,
  compact,
  staffLoading,
  usersLoading,
}: DailyPageTableViewProps) {
  const tableTextClass = compact ? 'text-xs' : 'text-sm sm:text-base';
  const cellClass = compact ? 'border px-3 py-2' : 'border px-4 py-3';
  const nowrapCellClass = `${cellClass} whitespace-nowrap`;
  const rowHoverClass = compact ? 'hover:bg-emerald-50/60' : 'hover:bg-emerald-50/40';

  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full border border-gray-300 ${tableTextClass}`}>
        <caption className="sr-only">日々の記録一覧</caption>
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr>
            <th className="border px-2 py-1">ID</th>
            <th className="border px-2 py-1">タイトル</th>
            <th className="border px-2 py-1">日付</th>
            <th className="border px-2 py-1">開始</th>
            <th className="border px-2 py-1">終了</th>
            <th className="border px-2 py-1">場所</th>
            <th className="border px-2 py-1">利用者</th>
            <th className="border px-2 py-1">担当スタッフ</th>
            <th className="border px-2 py-1">メモ</th>
            <th className="border px-2 py-1">食事ログ</th>
            <th className="border px-2 py-1">行動ログ</th>
            <th className="border px-2 py-1">状態</th>
            <th className="border px-2 py-1">最終更新</th>
            <th className="border px-2 py-1">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const staffLabel = row.staffId != null ? staffNameMap.get(Number(row.staffId)) : '';
            const userLabel = row.userId != null ? userNameMap.get(Number(row.userId)) : '';
            return (
              <tr key={row.id} className={`${i % 2 ? 'bg-gray-50' : 'bg-white'} ${rowHoverClass} transition-colors`}>
                <td className={`${cellClass} text-right font-medium text-gray-800`}>{row.id}</td>
                <td className={`${cellClass} font-semibold text-gray-900`} title={row.title ?? ''}>
                  {row.title ?? ''}
                </td>
                <td className={nowrapCellClass}>{dateOnly(row.date)}</td>
                <td className={nowrapCellClass}>{row.startTime ?? ''}</td>
                <td className={nowrapCellClass}>{row.endTime ?? ''}</td>
                <td className={`${cellClass} text-gray-700`} title={row.location ?? ''}>
                  {row.location ?? ''}
                </td>
                <td className={`${cellClass} ${!userLabel && usersLoading ? 'opacity-60' : ''}`}>
                  <span title={userLabel ? `${row.userId}（${userLabel}）` : String(row.userId ?? '')}>
                    {row.userId ?? ''}
                    {row.userId != null && userLabel ? `（${userLabel}）` : ''}
                  </span>
                </td>
                <td className={`${cellClass} ${!staffLabel && staffLoading ? 'opacity-60' : ''}`}>
                  <span title={staffLabel ? `${row.staffId}（${staffLabel}）` : String(row.staffId ?? '')}>
                    {row.staffId ?? ''}
                    {row.staffId != null && staffLabel ? `（${staffLabel}）` : ''}
                  </span>
                </td>
                <td className={`${cellClass} text-gray-600`}>
                  <span className="line-clamp-2" title={row.notes ?? ''}>
                    {row.notes ?? ''}
                  </span>
                </td>
                <td className={`${cellClass} text-gray-600`}>
                  <span className="line-clamp-2" title={row.mealLog ?? ''}>
                    {row.mealLog ?? ''}
                  </span>
                </td>
                <td className={cellClass}>
                  <StatusChip status={row.status} />
                </td>
                <td className={nowrapCellClass}>
                  <span title={row.modified ?? ''}>{row.modified ? row.modified.slice(0, 16).replace('T', ' ') : ''}</span>
                </td>
                <td className={`${cellClass} whitespace-nowrap`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      component={Link}
                      to={`/daily/${row.id}/edit`}
                      size="small"
                      variant="outlined"
                    >
                      編集
                    </Button>
                    <Button
                      component={Link}
                      to={`/daily/new?cloneId=${row.id}`}
                      size="small"
                      variant="text"
                    >
                      複製して作成
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
