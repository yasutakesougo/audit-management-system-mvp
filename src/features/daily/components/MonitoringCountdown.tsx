/**
 * MonitoringCountdown — 利用者別モニタリング会議カウントダウン
 *
 * 利用者ごとのアセスメント会議実施日を起点に、
 * 三ヶ月後の次回モニタリング会議までのカウントダウンを
 * ヘッダースペースにコンパクトに表示するウィジェット。
 *
 * - 利用者未選択: 非表示
 * - アセスメント日未設定: 「未設定」表示
 * - 次回会議日を過ぎている場合: 自動的に次のサイクルを計算
 */
import EventIcon from '@mui/icons-material/Event';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import { formatDateYmd } from '@/lib/dateFormat';

/* ------------------------------------------------------------------ */
/*  純粋ロジック（テスト可能）                                          */
/* ------------------------------------------------------------------ */

const MONITORING_INTERVAL_MONTHS = 3;
const MS_PER_DAY = 86_400_000;

export interface MonitoringCycleResult {
  /** 前回モニタリング会議日（= 直近のサイクル起点） */
  prevDate: Date;
  /** 次回モニタリング会議日 */
  nextDate: Date;
  /** 前回会議からの経過日数 */
  elapsed: number;
  /** 次回会議までの残り日数 */
  remaining: number;
  /** サイクル全体の日数 */
  totalDays: number;
  /** 進捗 (0-100) */
  progress: number;
}

/**
 * アセスメント会議実施日を起点に、三ヶ月ごとのモニタリングサイクルを計算する。
 *
 * アセスメント日から3ヶ月ごとに会議が繰り返される前提で、
 * 現在日に対して「直近の過去の会議日」と「次の会議日」を特定する。
 *
 * @param assessmentDate アセスメント会議実施日
 * @param now 現在日時（テスト用に差し替え可能）
 */
export function computeMonitoringCycle(
  assessmentDate: Date,
  now: Date,
): MonitoringCycleResult {
  // assessmentDate を起点に MONITORING_INTERVAL_MONTHS ごとのサイクルを刻む
  // 「今日」が含まれるサイクルの [prevDate, nextDate) を見つける
  let prevDate = new Date(assessmentDate);
  let nextDate = addMonths(prevDate, MONITORING_INTERVAL_MONTHS);

  // now がアセスメント日より前 → 最初のサイクルをそのまま返す
  if (now < prevDate) {
    const elapsed = 0;
    const totalDays = Math.round((nextDate.getTime() - prevDate.getTime()) / MS_PER_DAY);
    return {
      prevDate,
      nextDate,
      elapsed,
      remaining: totalDays,
      totalDays,
      progress: 0,
    };
  }

  // now が nextDate 以降なら、prevDate を進める
  while (nextDate.getTime() <= now.getTime()) {
    prevDate = new Date(nextDate);
    nextDate = addMonths(prevDate, MONITORING_INTERVAL_MONTHS);
  }

  const elapsed = Math.floor((now.getTime() - prevDate.getTime()) / MS_PER_DAY);
  const remaining = Math.ceil((nextDate.getTime() - now.getTime()) / MS_PER_DAY);
  const totalDays = Math.round((nextDate.getTime() - prevDate.getTime()) / MS_PER_DAY);
  const progress = Math.min(Math.max((elapsed / totalDays) * 100, 0), 100);

  return { prevDate, nextDate, elapsed, remaining, totalDays, progress };
}

/** 月を加算する（日付は同日。月末の場合は月末に丸める） */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // 月をまたぐとき日がずれる場合の補正（31日→28日 等）
  if (result.getDate() !== date.getDate()) {
    result.setDate(0); // 前月末に戻す
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  コンポーネント                                                      */
/* ------------------------------------------------------------------ */

/* removed: const formatDate wrapper — use formatDateYmd directly */

export type MonitoringCountdownProps = {
  /** 選択中の利用者名 */
  userName?: string;
  /** アセスメント会議実施日 (ISO 文字列 or null) */
  lastAssessmentDate?: string | null;
  /** テスト用に「今日」を差し替え可能 */
  today?: Date;
};

export const MonitoringCountdown: React.FC<MonitoringCountdownProps> = ({
  userName,
  lastAssessmentDate,
  today,
}) => {
  const now = useMemo(() => today ?? new Date(), [today]);

  // 利用者未選択 → 非表示
  if (!userName) return null;

  // アセスメント日未設定 → 「未設定」表示
  if (!lastAssessmentDate) {
    return (
      <Tooltip title="この利用者のアセスメント会議実施日が未設定です" arrow placement="bottom">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 2,
            bgcolor: 'action.hover',
            cursor: 'default',
            flexShrink: 0,
          }}
          data-testid="monitoring-countdown"
        >
          <WarningAmberIcon sx={{ fontSize: '0.9rem', color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
            会議日未設定
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  return <MonitoringCountdownInner assessmentDateStr={lastAssessmentDate} now={now} />;
};

/** 内部コンポーネント — アセスメント日が確定している場合 */
const MonitoringCountdownInner: React.FC<{ assessmentDateStr: string; now: Date }> = ({
  assessmentDateStr,
  now,
}) => {
  const cycle = useMemo(() => {
    const assessmentDate = new Date(`${assessmentDateStr}T00:00:00`);
    return computeMonitoringCycle(assessmentDate, now);
  }, [assessmentDateStr, now]);

  // 残り日数による色分け
  const urgencyColor = cycle.remaining <= 14 ? 'error' : cycle.remaining <= 30 ? 'warning' : 'primary';
  const urgencyLabel =
    cycle.remaining <= 7 ? '会議間近' : cycle.remaining <= 14 ? 'もうすぐ' : '';

  return (
    <Tooltip
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            モニタリング会議（三ヶ月ごと）
          </Typography>
          <Typography variant="caption" component="div">
            前回会議日：{formatDateYmd(cycle.prevDate)}（{cycle.elapsed}日前）
          </Typography>
          <Typography variant="caption" component="div">
            次回会議日：{formatDateYmd(cycle.nextDate)}（あと{cycle.remaining}日）
          </Typography>
          <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
            サイクル進捗：{Math.round(cycle.progress)}%（{cycle.elapsed}/{cycle.totalDays}日）
          </Typography>
        </Box>
      }
      arrow
      placement="bottom"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 0.5,
          borderRadius: 2,
          bgcolor: 'action.hover',
          cursor: 'default',
          minWidth: 'fit-content',
          flexShrink: 0,
        }}
        data-testid="monitoring-countdown"
      >
        <EventIcon
          fontSize="small"
          color={urgencyColor as 'error' | 'warning' | 'primary'}
          sx={{ fontSize: '1rem' }}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 80, gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="caption"
              fontWeight="bold"
              color={`${urgencyColor}.main`}
              sx={{ fontSize: '0.7rem', lineHeight: 1.2, whiteSpace: 'nowrap' }}
            >
              次回会議まで {cycle.remaining}日
            </Typography>
            {urgencyLabel && (
              <Chip
                label={urgencyLabel}
                size="small"
                color={urgencyColor as 'error' | 'warning'}
                sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
              />
            )}
          </Box>

          <LinearProgress
            variant="determinate"
            value={cycle.progress}
            color={urgencyColor as 'primary' | 'warning' | 'error'}
            sx={{
              height: 3,
              borderRadius: 1.5,
              bgcolor: 'grey.300',
              '& .MuiLinearProgress-bar': { borderRadius: 1.5 },
            }}
          />
        </Box>
      </Box>
    </Tooltip>
  );
};
