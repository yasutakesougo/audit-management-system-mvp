/**
 * UserTimelinePanel — 利用者タイムライン パネルコンポーネント
 *
 * 責務:
 *   - userId を受け取る
 *   - useUserTimeline(...) を呼ぶ
 *   - loading / error / empty を分岐表示
 *   - filter state を内部で管理
 *   - TimelineFilterBar + TimelineEventList を組み立てる
 *
 * 設計:
 *   - データ取得は外から注入された fetcher に委譲
 *   - 表示のみの責務（thin view layer）
 *   - ナビゲーションは sourceRef → resolveSourceRefPath → onNavigate コールバック
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import TimelineIcon from '@mui/icons-material/Timeline';
import type {
  TimelineEvent,
  TimelineFilter,
  TimelineRangePresetKey,
} from '@/domain/timeline';
import {
  resolveSourceRefPath,
  DEFAULT_RANGE_PRESET,
  computeRangeFilter,
} from '@/domain/timeline';
import type { IUserMaster } from '@/features/users/types';
import {
  useUserTimeline,
  type TimelineDataFetcher,
} from '@/features/timeline/useUserTimeline';
import { TimelineFilterBar } from './TimelineFilterBar';
import { TimelineEventList } from './TimelineEventList';
import { motionTokens } from '@/app/theme';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface UserTimelinePanelProps {
  /** 対象利用者 ID */
  userId: string;
  /** 対象利用者名（ヘッダー表示用、省略可） */
  userName?: string;
  /** データ取得関数 */
  fetcher: TimelineDataFetcher;
  /** UserMaster 一覧（Handoff resolver 構築用） */
  users: IUserMaster[];
  /** ソース詳細画面への遷移コールバック */
  onNavigate?: (path: string) => void;
  /** sourceCounts が確定したときのコールバック（タブ見出しバッジ等に使用） */
  onSourceCountsReady?: (counts: { total: number }) => void;
}

// ─────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────

const TimelineSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {/* Filter bar skeleton */}
    <Box sx={{ display: 'flex', gap: 1 }}>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton
          key={i}
          variant="rounded"
          width={90}
          height={28}
          sx={{ borderRadius: 4 }}
        />
      ))}
      <Box sx={{ ml: 'auto' }}>
        <Skeleton variant="rounded" width={120} height={32} />
      </Box>
    </Box>
    <Skeleton variant="text" width={80} height={18} />

    {/* Event cards skeleton */}
    <Skeleton variant="text" width={60} height={16} />
    {[1, 2, 3, 4, 5].map((i) => (
      <Skeleton
        key={i}
        variant="rounded"
        height={72}
        sx={{ borderRadius: 1 }}
      />
    ))}
  </Box>
);

// ─────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────

const TimelineEmptyState: React.FC<{ userName?: string }> = ({ userName }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 6,
      px: 3,
      textAlign: 'center',
    }}
  >
    <TimelineIcon
      sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4, mb: 2 }}
    />
    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
      タイムラインイベントがありません
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {userName
        ? `${userName}さんの日々の記録・インシデント・個別支援計画・申し送りが表示されます。`
        : 'この利用者の記録がまだありません。'}
    </Typography>
  </Box>
);

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const UserTimelinePanel: React.FC<UserTimelinePanelProps> = ({
  userId,
  userName,
  fetcher,
  users,
  onNavigate,
  onSourceCountsReady,
}) => {
  // ── Filter state（このパネル内で管理） ──
  const [filter, setFilter] = useState<TimelineFilter>({});
  const [rangePreset, setRangePreset] =
    useState<TimelineRangePresetKey>(DEFAULT_RANGE_PRESET);

  // ── 期間プリセットから from/to を計算 ──
  const rangeFilter = useMemo(() => computeRangeFilter(rangePreset), [rangePreset]);

  // ── filter + rangeFilter をマージして hook に渡す ──
  const mergedFilter = useMemo<TimelineFilter>(
    () => ({ ...filter, from: rangeFilter.from, to: rangeFilter.to }),
    [filter, rangeFilter],
  );

  // ── hook 呼び出し ──
  const { events, isLoading, error, refresh, sourceCounts } = useUserTimeline(
    userId,
    fetcher,
    users,
    { filter: mergedFilter },
  );

  // ── sourceCounts が確定したら親に通知 ──
  useEffect(() => {
    if (!isLoading && onSourceCountsReady) {
      onSourceCountsReady({ total: sourceCounts.total });
    }
  }, [isLoading, sourceCounts.total, onSourceCountsReady]);

  // ── Event open handler ──
  const handleOpenEvent = useCallback(
    (event: TimelineEvent) => {
      if (!onNavigate) return;
      const path = resolveSourceRefPath(event.sourceRef);
      if (path) {
        onNavigate(path);
      }
    },
    [onNavigate],
  );

  // ── Error ──
  if (error) {
    return (
      <Box>
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              onClick={refresh}
              startIcon={<RefreshIcon />}
            >
              再試行
            </Button>
          }
        >
          タイムラインの取得に失敗しました: {error.message}
        </Alert>
      </Box>
    );
  }

  // ── Loading ──
  if (isLoading) {
    return <TimelineSkeleton />;
  }

  // ── Content ──
  const hasAnyData = sourceCounts.total > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* ヘッダー */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontWeight: 700,
          }}
        >
          <TimelineIcon color="primary" />
          {userName ? `${userName}さんのタイムライン` : 'タイムライン'}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={
            isLoading ? (
              <CircularProgress size={14} />
            ) : (
              <RefreshIcon />
            )
          }
          onClick={refresh}
          disabled={isLoading}
          sx={{
            textTransform: 'none',
            fontSize: '0.8rem',
            transition: motionTokens.transition.microAll,
          }}
        >
          更新
        </Button>
      </Box>

      {/* フィルタバー（データがある場合のみ） */}
      {hasAnyData && (
        <TimelineFilterBar
          filter={filter}
          onFilterChange={setFilter}
          rangePreset={rangePreset}
          onRangePresetChange={setRangePreset}
          sourceCounts={sourceCounts}
          unresolvedHandoff={sourceCounts.unresolvedHandoff}
          totalCount={events.length}
        />
      )}

      {/* イベント一覧 or Empty */}
      {events.length > 0 ? (
        <TimelineEventList events={events} onOpen={onNavigate ? handleOpenEvent : undefined} />
      ) : hasAnyData ? (
        // フィルタ結果が空
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            現在のフィルタ条件に一致するイベントがありません。
          </Typography>
          <Button
            size="small"
            sx={{ mt: 1, textTransform: 'none' }}
            onClick={() => {
              setFilter({});
              setRangePreset(DEFAULT_RANGE_PRESET);
            }}
          >
            フィルタをリセット
          </Button>
        </Box>
      ) : (
        <TimelineEmptyState userName={userName} />
      )}
    </Box>
  );
};
