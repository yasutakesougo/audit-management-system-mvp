/**
 * DailyPageCardView — Card-mode rendering for daily records
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

interface DailyPageCardViewProps {
  rows: DailyRecordItem[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DailyPageCardView({ rows }: DailyPageCardViewProps) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const staffLabel = row.reporter?.name || '';
        const primaryDate = dateOnly(row.date);
        return (
          <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-base font-semibold text-gray-900">
                  日次記録
                  <span className="ml-2 text-xs font-normal text-gray-500">#{row.id}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {primaryDate || '日付未設定'}
                </div>
                <div className="text-sm text-gray-600">
                  報告者: {staffLabel || '未設定'}
                </div>
                <div className="text-sm text-gray-600">
                  利用者数: {row.userCount}名
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusChip status={row.approvalStatus} />
                <Button
                  component={Link}
                  to={`/daily/new?date=${row.date}`}
                  size="small"
                  variant="contained"
                  color="primary"
                >
                  開く
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>最終更新: {row.modifiedAt ?? '-'}</span>
              <span>作成: {row.createdAt ?? '-'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
