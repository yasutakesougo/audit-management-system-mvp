/**
 * KioskHeroBlock — キオスク専用アクション集約ブロック
 *
 * Phase 2: Hero + アラート + 進捗 + QuickLinks を1ブロックに統合。
 *
 * 設計原則:
 *   - CTA は1つだけ（HeroActionCard が担当）
 *   - 上段: 行動（Hero）、下段: 注意事項（インラインアラート）
 *   - HeroActionCard 本体は変更しない（ラッパーとして統合）
 *   - 通常モードには影響しない
 *
 * 構造:
 *   ┌─────────────────────────────────────┐
 *   │  HeroActionCard (既存・無変更)       │
 *   ├─────────────────────────────────────┤
 *   │  ⚠️ インラインアラート（コンパクト）  │
 *   ├─────────────────────────────────────┤
 *   │  ProgressRings (既存・無変更)        │
 *   ├─────────────────────────────────────┤
 *   │  KioskQuickLinks (既存・無変更)      │
 *   └─────────────────────────────────────┘
 */
import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useNavigate } from 'react-router-dom';

import { MonitoringCountdown, computeMonitoringCycle } from '@/features/daily/components/MonitoringCountdown';
import { HeroActionCard, type HeroActionCardProps } from './HeroActionCard';
import { ProgressRings, type ProgressRingItem } from './ProgressRings';
import { KioskQuickLinks } from './KioskQuickLinks';
import type { UseTodayExceptionsResult } from '../hooks/useTodayExceptions';
import type { TodayExceptionAction } from '@/features/exceptions/domain/buildTodayExceptions';

// ─── Types ───────────────────────────────────────────────────

export type KioskHeroBlockProps = {
  /** HeroActionCard に渡す props */
  heroProps: HeroActionCardProps;
  /** 司令塔アラートデータ */
  exceptionsQueue?: UseTodayExceptionsResult;
  /** 進捗リング（undefined 時は非表示） */
  progressRings?: ProgressRingItem[];
  /** クイックリンク遷移ハンドラ */
  onQuickLinkNavigate?: (href: string) => void;
  /** 全利用者リスト（モニタリング警告対象の抽出に使用） */
  users?: import('@/sharepoint/fields/userFields').IUserMaster[];
};

// ─── Inline Alert Item ───────────────────────────────────────

const InlineAlertItem: React.FC<{
  item: TodayExceptionAction;
  onNavigate: (path: string) => void;
}> = ({ item, onNavigate }) => {
  const theme = useTheme();
  const isHigh = item.priority === 'critical';

  return (
    <Box
      data-testid={`kiosk-inline-alert-${item.id}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(
          isHigh ? theme.palette.error.main : theme.palette.warning.main,
          0.08,
        ),
      }}
    >
      <WarningAmberRoundedIcon
        sx={{
          fontSize: '1rem',
          color: isHigh ? 'error.main' : 'warning.main',
          flexShrink: 0,
        }}
      />
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          fontWeight: 600,
          fontSize: '0.82rem',
          color: 'text.primary',
        }}
      >
        {item.title}
      </Typography>
      {/* セカンダリアクション（支援記録など） */}
      {item.secondaryActionPath && (
        <Chip
          label={item.secondaryActionLabel ?? '確認'}
          size="small"
          icon={<ArrowForwardRoundedIcon sx={{ fontSize: '0.85rem !important' }} />}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(item.secondaryActionPath!);
          }}
          sx={{
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 26,
            flexShrink: 0,
            '& .MuiChip-icon': { ml: '4px', mr: '-2px' },
            cursor: 'pointer',
          }}
          color="default"
          variant="outlined"
        />
      )}
      {/* プライマリアクション（記録を作成） */}
      <Chip
        label={item.actionLabel ?? '対応'}
        size="small"
        icon={<ArrowForwardRoundedIcon sx={{ fontSize: '0.85rem !important' }} />}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(item.actionPath);
        }}
        sx={{
          fontWeight: 600,
          fontSize: '0.7rem',
          height: 26,
          flexShrink: 0,
          '& .MuiChip-icon': { ml: '4px', mr: '-2px' },
          cursor: 'pointer',
        }}
        color={isHigh ? 'error' : 'warning'}
        variant="outlined"
      />
    </Box>
  );
};

// ─── Component ───────────────────────────────────────────────

export const KioskHeroBlock: React.FC<KioskHeroBlockProps> = ({
  heroProps,
  exceptionsQueue,
  progressRings,
  onQuickLinkNavigate,
  users = [],
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  // ── アラート集約（Hero と Queue を統合して最大4件） ──
  const alertItems = React.useMemo(() => {
    if (!exceptionsQueue || exceptionsQueue.isLoading) return [];

    const all: TodayExceptionAction[] = [];
    if (exceptionsQueue.heroItem) all.push(exceptionsQueue.heroItem);
    all.push(...exceptionsQueue.queueItems);

    return all.slice(0, 4);
  }, [exceptionsQueue]);

  // ── モニタリング警告（残り30日以内） ──
  const monitoringAlerts = React.useMemo(() => {
    if (!users) return [];
    const now = new Date();
    return users
      .filter((u) => u.LastAssessmentDate)
      .map((u) => {
        const assessmentDate = new Date(`${u.LastAssessmentDate}T00:00:00`);
        const cycle = computeMonitoringCycle(assessmentDate, now);
        return {
          userId: u.UserID,
          userName: u.FullName,
          lastAssessmentDate: u.LastAssessmentDate,
          remaining: cycle.remaining,
        };
      })
      .filter((u) => u.remaining <= 30) // 30日以内のみ表示
      .sort((a, b) => a.remaining - b.remaining) // 期限が近い順
      .slice(0, 3); // Kiosk では最大3件に絞る
  }, [users]);

  const handleAlertNavigate = React.useCallback(
    (path: string) => navigate(path),
    [navigate],
  );

  return (
    <Box data-testid="kiosk-hero-block">
      {/* ── 上段: HeroActionCard（既存・無変更） ── */}
      <HeroActionCard {...heroProps} />

      {/* ── 中段: インラインアラート（コンパクト） ── */}
      {alertItems.length > 0 && (
        <Box
          data-testid="kiosk-inline-alerts"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: '0.68rem',
              letterSpacing: '0.08em',
              color: 'text.secondary',
              mb: 0.25,
            }}
          >
            ⚠️ 要確認（{alertItems.length}件）
          </Typography>
          {alertItems.map((item) => (
            <InlineAlertItem
              key={item.id}
              item={item}
              onNavigate={handleAlertNavigate}
            />
          ))}
        </Box>
      )}

      {/* ── 中段2: モニタリング予定（カウントダウン） ── */}
      {monitoringAlerts.length > 0 && (
        <Box
          data-testid="kiosk-monitoring-alerts"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: '0.68rem',
              letterSpacing: '0.08em',
              color: 'text.secondary',
              mb: 0.5,
            }}
          >
            📅 モニタリング期限
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {monitoringAlerts.map((alert) => (
              <Box key={alert.userId} sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 0.5, boxShadow: 1 }}>
                <Typography variant="caption" sx={{ ml: 1, fontWeight: 600, color: 'text.secondary' }}>
                  {alert.userName}
                </Typography>
                <MonitoringCountdown
                  userName={alert.userName}
                  lastAssessmentDate={alert.lastAssessmentDate}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* ── 下段: ProgressRings ── */}
      {progressRings && progressRings.length > 0 && (
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontWeight: 700,
              fontSize: '0.68rem',
              letterSpacing: '0.08em',
              color: 'text.secondary',
              mb: 0.5,
            }}
          >
            📊 本日の進捗
          </Typography>
          <ProgressRings items={progressRings} />
        </Box>
      )}

      {/* ── 最下段: KioskQuickLinks ── */}
      {onQuickLinkNavigate && (
        <KioskQuickLinks onNavigate={onQuickLinkNavigate} />
      )}
    </Box>
  );
};
