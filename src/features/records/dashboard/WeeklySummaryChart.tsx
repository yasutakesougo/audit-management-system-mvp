import React, { useMemo } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import { computeWeekSummary } from '@/features/records/dashboard/progress';
import { TESTIDS } from '@/testing/testids';

type Props = {
  userIds: string[];
  weekStartYYYYMMDD: string; // 週の開始日（規定: 月曜開始など）
  variant?: 'line' | 'bar';
  height?: number;
  showLegend?: boolean;
};

const parseYmd = (ymd: string): Date => {
  // ymd: 'YYYY-MM-DD' をローカルタイムでパース（TZずれ防止）
  const [y, m, d] = ymd.split('-').map((s) => Number(s));
  return new Date(y, (m || 1) - 1, d || 1);
};

const addDays = (date: Date, days: number): Date => {
  const dt = new Date(date);
  dt.setDate(dt.getDate() + days);
  return dt;
};

const formatDayLabel = (date: Date) => {
  // 例: 2025-10-20 -> "10/20"（ローカル基準）
  return `${date.getMonth() + 1}/${date.getDate()}`;
};


export const WeeklySummaryChart: React.FC<Props> = ({ userIds, weekStartYYYYMMDD, variant = 'line', height = 260, showLegend = true }) => {
  const summary = useMemo(() => computeWeekSummary(userIds, weekStartYYYYMMDD), [userIds, weekStartYYYYMMDD]);

  const data = useMemo(() => {
    const base = parseYmd(weekStartYYYYMMDD);
    return summary.days.map((d, i) => {
      const dayDate = addDays(base, i);
      return {
        idx: i,
        day: formatDayLabel(dayDate),
        rate: Math.round((d.completionRate + Number.EPSILON) * 10) / 10, // 小数1桁に丸め
        recorded: d.recordedSlots,
        total: d.totalSlots,
      };
    });
  }, [summary.days, weekStartYYYYMMDD]);

  return (
    <Card
      data-testid={TESTIDS.DASHBOARD.WEEKLY_CHART}
      data-weekstart={weekStartYYYYMMDD}
      data-users={summary.totalUsers}
      elevation={1}
    >
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          週次完了率（%）
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          週開始日: {weekStartYYYYMMDD} ／ 対象ユーザー: {summary.totalUsers} 名
        </Typography>

        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            {variant === 'bar' ? (
              <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 4 }} barCategoryGap={8}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(value: unknown, name: string, payload) => {
                    if (name === 'rate') {
                      const { recorded, total } = (payload?.payload ?? {}) as { recorded?: number; total?: number };
                      return [`${String(value)}%${recorded !== undefined && total !== undefined ? ` (${recorded}/${total})` : ''}`, '完了率'];
                    }
                    return [String(value), name];
                  }}
                />
                {showLegend ? <Legend /> : null}
                <Bar dataKey="rate" name="完了率" isAnimationActive />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(value: unknown, name: string, payload) => {
                    if (name === 'rate') {
                      const { recorded, total } = (payload?.payload ?? {}) as { recorded?: number; total?: number };
                      return [`${String(value)}%${recorded !== undefined && total !== undefined ? ` (${recorded}/${total})` : ''}`, '完了率'];
                    }
                    return [String(value), name];
                  }}
                />
                {showLegend ? <Legend /> : null}
                <Line type="monotone" dataKey="rate" name="完了率" dot isAnimationActive />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
