/**
 * ExceptionCenterPage — Control Layer の管理画面
 *
 * MVP-007: ExceptionTable (MVP-006) を配置し、例外統計カードを表示する。
 * Sprint 1 最後のピース — 現場ループ + 管理入口の輪を閉じる。
 *
 * ## 構成
 * - Header: タイトル + 説明
 * - SummaryCards: 未入力数、重要申し送り数、注意対象数
 * - ExceptionTable: フィルタ付き例外一覧
 *
 * ## 設計方針
 * - 新しい複雑ロジックは増やさず、MVP-006 の部品を配置する回
 * - EmptyStateAction (MVP-001) を例外0件時に表示
 * - Phase 2 でドロワー/詳細モーダルを追加予定
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ── MUI ──
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ── Domain ──
import {
  aggregateExceptions,
  computeExceptionStats,
  detectAttentionUsers,
  detectDataLayerExceptions,
  type ExceptionCategory,
} from '@/features/exceptions/domain/exceptionLogic';
import { parseExceptionCenterDeepLinkParams } from '@/features/exceptions/domain/exceptionCenterDeepLink';
import { ExceptionTable } from '@/features/exceptions/components/ExceptionTable';
import { applyExceptionPreferences } from '@/features/exceptions/domain/applyExceptionPreferences';
import { useExceptionDataSources } from '@/features/exceptions/hooks/useExceptionDataSources';
import { useCorrectiveActionExceptions } from '@/features/exceptions/hooks/useCorrectiveActionExceptions';
import { useTransportExceptions } from '@/features/exceptions/hooks/useTransportExceptions';
import { useHandoffExceptions } from '@/features/exceptions/hooks/useHandoffExceptions';
import { useDailyRecordExceptions } from '@/features/exceptions/hooks/useDailyRecordExceptions';
import { useActiveExceptionPreferences } from '@/features/exceptions/hooks/useExceptionPreferences';
import type { SnoozePreset } from '@/features/action-engine/domain/computeSnoozeUntil';
import { computeSnoozeUntil } from '@/features/action-engine/domain/computeSnoozeUntil';
import { useSuggestionStateStore } from '@/features/action-engine/hooks/useSuggestionStateStore';
import { useAllCorrectiveActions } from '@/features/action-engine/hooks/useAllCorrectiveActions';
import {
  buildSuggestionTelemetryEvent,
  type SuggestionTelemetryCtaSurface,
  SUGGESTION_TELEMETRY_EVENTS,
} from '@/features/action-engine/telemetry/buildSuggestionTelemetryEvent';
import { recordSuggestionTelemetry } from '@/features/action-engine/telemetry/recordSuggestionTelemetry';
import { queuePendingSuggestionDeepLink } from '@/features/action-engine/telemetry/suggestionDeepLinkTracker';

// ─── Component ────────────────────────────────────────────────

export default function ExceptionCenterPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkFilters = useMemo(
    () => parseExceptionCenterDeepLinkParams(searchParams),
    [searchParams],
  );

  // Action Engine: 全利用者分の是正提案を自給自足
  const { suggestions: allSuggestions, status: suggestionsStatus, error: suggestionsError } = useAllCorrectiveActions();
  const suggestionStates = useSuggestionStateStore((s) => s.states);
  const dismissSuggestion = useSuggestionStateStore((s) => s.dismiss);
  const snoozeSuggestion = useSuggestionStateStore((s) => s.snooze);

  // Sprint-1 Phase B: 実データ接続
  const dataSources = useExceptionDataSources();

  // Step 4: Transport テレメトリ → ExceptionItem
  const { items: transportItems, status: transportStatus } = useTransportExceptions();
  const { items: handoffItems } = useHandoffExceptions({
    handoffs: dataSources.criticalHandoffs,
  });
  const { items: dailyRecordItems } = useDailyRecordExceptions({
    expectedUsers: dataSources.expectedUsers,
    existingRecords: dataSources.todayRecords,
    targetDate: dataSources.today,
  });
  
  const [categoryFilter, setCategoryFilter] = useState<ExceptionCategory | 'all'>(
    deepLinkFilters.category,
  );
  useEffect(() => {
    setCategoryFilter(deepLinkFilters.category);
  }, [deepLinkFilters.category]);

  const handleCategoryFilterChange = React.useCallback((next: ExceptionCategory | 'all') => {
    setCategoryFilter(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'all') nextParams.delete('category');
    else nextParams.set('category', next);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearDeepLinkFilters = React.useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  const suggestionByStableId = useMemo(() => {
    return new Map(allSuggestions.map((s) => [s.stableId, s]));
  }, [allSuggestions]);

  // Action Engine 提案 → ExceptionItem
  const { items: correctiveItems } = useCorrectiveActionExceptions({
    suggestions: allSuggestions,
    states: suggestionStates,
  });

  const handleDismissSuggestion = React.useCallback((stableId: string) => {
    const suggestion = suggestionByStableId.get(stableId);
    if (suggestion) {
      recordSuggestionTelemetry(
        buildSuggestionTelemetryEvent({
          event: SUGGESTION_TELEMETRY_EVENTS.DISMISSED,
          sourceScreen: 'exception-center',
          stableId: suggestion.stableId,
          ruleId: suggestion.ruleId,
          priority: suggestion.priority,
          targetUserId: suggestion.targetUserId,
        }),
      );
    }
    dismissSuggestion(stableId, { by: 'exception-center' });
  }, [dismissSuggestion, suggestionByStableId]);

  const handleSnoozeSuggestion = React.useCallback((stableId: string, preset: SnoozePreset) => {
    const suggestion = suggestionByStableId.get(stableId);
    const until = computeSnoozeUntil(preset, new Date());
    if (suggestion) {
      recordSuggestionTelemetry(
        buildSuggestionTelemetryEvent({
          event: SUGGESTION_TELEMETRY_EVENTS.SNOOZED,
          sourceScreen: 'exception-center',
          stableId: suggestion.stableId,
          ruleId: suggestion.ruleId,
          priority: suggestion.priority,
          targetUserId: suggestion.targetUserId,
          snoozePreset: preset,
          snoozedUntil: until,
        }),
      );
    }
    snoozeSuggestion(stableId, until, { by: 'exception-center' });
  }, [snoozeSuggestion, suggestionByStableId]);

  const handleSuggestionCtaClick = React.useCallback((
    stableId: string,
    targetUrl: string,
    ctaSurface: SuggestionTelemetryCtaSurface = 'table',
  ) => {
    const suggestion = suggestionByStableId.get(stableId);
    if (!suggestion) return;
    const event = buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
      sourceScreen: 'exception-center',
      stableId: suggestion.stableId,
      ruleId: suggestion.ruleId,
      priority: suggestion.priority,
      targetUserId: suggestion.targetUserId,
      targetUrl,
      ctaSurface,
    });
    recordSuggestionTelemetry(event);
    queuePendingSuggestionDeepLink(event);
  }, [suggestionByStableId]);

  const handlePriorityTopShown = React.useCallback((stableIds: string[]) => {
    for (const stableId of stableIds) {
      const suggestion = suggestionByStableId.get(stableId);
      if (!suggestion) continue;
      recordSuggestionTelemetry(
        buildSuggestionTelemetryEvent({
          event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
          sourceScreen: 'exception-center',
          stableId: suggestion.stableId,
          ruleId: suggestion.ruleId,
          priority: suggestion.priority,
          targetUserId: suggestion.targetUserId,
          ctaSurface: 'priority-top3',
        }),
        {
          dedupeKey: `suggestion_shown:exception-center:${suggestion.stableId}:priority-top3`,
        },
      );
    }
  }, [suggestionByStableId]);

  const { dismissedStableIds, snoozedStableIds } = useActiveExceptionPreferences();

  // ── 例外検出（実データ） ──
  const exceptions = useMemo(() => {
    const attentionUsers = detectAttentionUsers(dataSources.userSummaries);
    const dataOSItems = detectDataLayerExceptions(dataSources.dataOSResolutions);

    const aggregated = aggregateExceptions(
      dailyRecordItems,
      handoffItems,
      attentionUsers,
      correctiveItems,
      transportItems,
      dataOSItems,
    );
    return applyExceptionPreferences(aggregated, dismissedStableIds, snoozedStableIds);
  }, [dailyRecordItems, dataSources, handoffItems, correctiveItems, transportItems, dismissedStableIds, snoozedStableIds]);

  const scopedExceptions = useMemo(() => {
    if (!deepLinkFilters.userId) return exceptions;
    return exceptions.filter((item) => item.targetUserId === deepLinkFilters.userId);
  }, [exceptions, deepLinkFilters.userId]);

  const stats = useMemo(() => computeExceptionStats(scopedExceptions), [scopedExceptions]);

  // ── SummaryCard 定義 ──
  const summaryCards = [
    {
      key: 'missing-record',
      label: '未入力記録',
      count: stats.byCategory['missing-record'],
      icon: '📝',
      color: '#e53935',
    },
    {
      key: 'critical-handoff',
      label: '重要申し送り',
      count: stats.byCategory['critical-handoff'],
      icon: '🔴',
      color: '#d32f2f',
    },
    {
      key: 'attention-user',
      label: '注意対象者',
      count: stats.byCategory['attention-user'],
      icon: '⚠️',
      color: '#ed6c02',
    },
    {
      key: 'corrective-action',
      label: '改善提案',
      count: stats.byCategory['corrective-action'],
      icon: '🔧',
      color: '#1565c0',
    },
    {
      key: 'transport-alert',
      label: '送迎異常',
      count: stats.byCategory['transport-alert'],
      icon: '🚐',
      color: '#7b1fa2',
    },
    {
      key: 'data-os-alert',
      label: 'システム異常',
      count: stats.byCategory['data-os-alert'],
      icon: '📡',
      color: '#00bcd4',
    },
    {
      key: 'total',
      label: '合計例外',
      count: stats.total,
      icon: '📊',
      color: stats.total > 0 ? '#f57c00' : '#2e7d32',
    },
  ];

  // 是正提案データの取得状況を loading に含める
  const isLoading = dataSources.status === 'loading' || suggestionsStatus === 'loading' || transportStatus === 'loading';
  const hasVisibleExceptions = scopedExceptions.length > 0;
  const hasDeepLinkFilters = deepLinkFilters.category !== 'all' || !!deepLinkFilters.userId;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="exception-center-page">
      {/* ── Back Navigation ── */}
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate('/admin')}
        sx={{ mb: 2, color: 'text.primary' }}
        data-testid="exception-center-back"
      >
        管理ツールに戻る
      </Button>

      {hasDeepLinkFilters && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          data-testid="exception-center-deeplink-filters"
          action={(
            <Button color="inherit" size="small" onClick={clearDeepLinkFilters}>
              絞り込み解除
            </Button>
          )}
        >
          Today からの絞り込みを適用中
          {deepLinkFilters.category !== 'all' ? ` / category=${deepLinkFilters.category}` : ''}
          {deepLinkFilters.userId ? ` / userId=${deepLinkFilters.userId}` : ''}
        </Alert>
      )}

      {/* ── Loading 状態 ── */}
      {isLoading && (
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
            {[1,2,3,4].map(i => <Skeleton key={i} variant="rectangular" height={100} sx={{ borderRadius: 2 }} />)}
          </Box>
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
        </Stack>
      )}

      {/* ── Error 状態 ── */}
      {dataSources.status === 'error' && (
        <Alert severity="error" sx={{ my: 2 }} data-testid="exception-center-error">
          データの取得に失敗しました: {dataSources.error}
        </Alert>
      )}

      {/* ── 是正提案 Error 状態（他のデータソースとは独立） ── */}
      {suggestionsStatus === 'error' && suggestionsError && (
        <Alert severity="warning" sx={{ my: 1 }} data-testid="exception-center-suggestions-error">
          是正提案の取得に失敗しました: {suggestionsError}
        </Alert>
      )}

      {/* ── Empty 状態 ── */}
      {!isLoading && !hasVisibleExceptions && dataSources.status !== 'error' && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }} data-testid="exception-center-empty">
          <Typography variant="h5" sx={{ mb: 1 }}>✅</Typography>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>例外は検出されていません</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            現在、対応が必要な例外はありません。
          </Typography>
        </Paper>
      )}

      {/* ── Ready 状態 ── */}
      {!isLoading && hasVisibleExceptions && (
      <Stack spacing={3}>
        {/* ════════════════════════════════════════════════════════════
            Header
           ════════════════════════════════════════════════════════════ */}
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            ⚡ 例外センター
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            対応が必要な例外を一覧表示します。未入力記録、重要申し送り、注意対象者を確認してください。
          </Typography>
        </Box>

        {/* ════════════════════════════════════════════════════════════
            Summary Cards
           ════════════════════════════════════════════════════════════ */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
            gap: 2,
          }}
          data-testid="exception-summary-cards"
        >
          {summaryCards.map((card) => {
            const isSelected = categoryFilter === (card.key === 'total' ? 'all' : card.key);

            return (
              <Paper
                key={card.key}
                variant="outlined"
                onClick={() => handleCategoryFilterChange(
                  card.key === 'total' ? 'all' : card.key as ExceptionCategory,
                )}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  borderLeft: 4,
                  borderLeftColor: card.color,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: isSelected ? `${card.color}15` : 'background.paper',
                  borderColor: isSelected ? card.color : 'divider',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: `${card.color}0A`,
                  }
                }}
                data-testid={`summary-card-${card.key}`}
              >
                <Box sx={{ fontSize: 28, mb: 0.5 }}>{card.icon}</Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: card.color }}>
                  {card.count}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {card.label}
                </Typography>
              </Paper>
            );
          })}
        </Box>

        {/* ════════════════════════════════════════════════════════════
            Exception Table (MVP-006)
           ════════════════════════════════════════════════════════════ */}
        <ExceptionTable
          items={scopedExceptions}
          title="対応が必要な例外"
          showFilters
          initialSortMode="priority"
          categoryFilter={categoryFilter}
          onCategoryFilterChange={handleCategoryFilterChange}
          suggestionActions={{
            onDismiss: handleDismissSuggestion,
            onSnooze: handleSnoozeSuggestion,
            onCtaClick: handleSuggestionCtaClick,
            onPriorityTopShown: handlePriorityTopShown,
          }}
        />
      </Stack>
      )}
    </Container>
  );
}
