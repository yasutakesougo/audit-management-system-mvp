/**
 * DailyPageCardView — Card-mode rendering for daily records
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
  status?: string | null;
  modified?: string | null;
  created?: string | null;
  staffId?: string | number | null;
  userId?: string | number | null;
}

interface DailyPageCardViewProps {
  rows: DailyRow[];
  staffNameMap: Map<number, string>;
  userNameMap: Map<number, string>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DailyPageCardView({ rows, staffNameMap, userNameMap }: DailyPageCardViewProps) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const staffLabel = row.staffId != null ? staffNameMap.get(Number(row.staffId)) : '';
        const userLabel = row.userId != null ? userNameMap.get(Number(row.userId)) : '';
        const primaryDate = dateOnly(row.date);
        return (
          <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-base font-semibold text-gray-900">
                  {row.title?.trim() || '（無題）'}
                  <span className="ml-2 text-xs font-normal text-gray-500">#{row.id}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {primaryDate || '日付未設定'}・{row.startTime ?? '---'}〜{row.endTime ?? '---'}
                </div>
                <div className="text-sm text-gray-600">
                  担当: {staffLabel || '未設定'}
                </div>
                {row.userId != null ? (
                  <div className="text-sm text-gray-600">
                    利用者: {userLabel ? `${userLabel}（${row.userId}）` : row.userId}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusChip status={row.status} />
                <Button
                  component={Link}
                  to={`/daily/${row.id}/edit`}
                  size="small"
                  variant="contained"
                  color="primary"
                >
                  編集
                </Button>
              </div>
            </div>
            {row.location ? (
              <div className="mt-3 text-sm text-gray-700">場所: {row.location}</div>
            ) : null}
            {row.notes ? (
              <div className="mt-2 text-sm text-gray-700">メモ: {row.notes}</div>
            ) : null}
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>更新: {row.modified ?? '-'}</span>
              <span>登録: {row.created ?? '-'}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                component={Link}
                to={`/daily/new?cloneId=${row.id}`}
                size="small"
                variant="text"
              >
                複製して作成
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
