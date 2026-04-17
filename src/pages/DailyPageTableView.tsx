/**
 * DailyPageTableView — Table-mode rendering for daily records
 *
 * Extracted from DailyPage.tsx for single-responsibility.
 */

import Button from '@mui/material/Button';
import Chip, { type ChipProps } from '@mui/material/Chip';
import { Link } from 'react-router-dom';
import { dateOnly } from './dailyPageConstants';
import type { DailyRecordItem } from '@/features/daily/schema';

// ─── StatusChip ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status?: string | null }) {
  const normalized = (status ?? '').toLowerCase() || 'draft';
  const color: ChipProps['color'] = normalized === 'approved' ? 'success' : 'default';
  const label = normalized === 'approved' ? '承認済' : '下書き';
  return <Chip size="small" color={color} variant="outlined" label={label} />;
}

interface DailyPageTableViewProps {
  rows: DailyRecordItem[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DailyPageTableView({
  rows,
}: DailyPageTableViewProps) {
  const tableTextClass = 'text-sm sm:text-base';
  const cellClass = 'border px-4 py-3';
  const nowrapCellClass = `${cellClass} whitespace-nowrap`;
  const rowHoverClass = 'hover:bg-emerald-50/40';

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
            const staffLabel = row.reporter?.name || '';
            return (
              <tr key={row.id} className={`${i % 2 ? 'bg-gray-50' : 'bg-white'} ${rowHoverClass} transition-colors`}>
                <td className={`${cellClass} text-right font-medium text-gray-800`}>{row.id}</td>
                <td className={`${cellClass} font-semibold text-gray-900`}>
                  日次記録
                </td>
                <td className={nowrapCellClass}>{dateOnly(row.date)}</td>
                <td className={nowrapCellClass}>-</td>
                <td className={nowrapCellClass}>-</td>
                <td className={`${cellClass} text-gray-700`}>
                  -
                </td>
                <td className={`${cellClass}`}>
                  {row.userCount}名
                </td>
                <td className={`${cellClass}`}>
                  <span title={staffLabel}>
                    {staffLabel}
                  </span>
                </td>
                <td className={`${cellClass} text-gray-600`}>
                  -
                </td>
                <td className={`${cellClass} text-gray-600`}>
                  -
                </td>
                <td className={`${cellClass} text-gray-600`}>
                  -
                </td>
                <td className={cellClass}>
                  <StatusChip status={row.approvalStatus} />
                </td>
                <td className={nowrapCellClass}>
                  <span title={row.modifiedAt ?? ''}>{row.modifiedAt ? row.modifiedAt.slice(0, 16).replace('T', ' ') : ''}</span>
                </td>
                <td className={`${cellClass} whitespace-nowrap`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      component={Link}
                      to={`/daily/new?date=${row.date}`}
                      size="small"
                      variant="outlined"
                    >
                      開く
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
