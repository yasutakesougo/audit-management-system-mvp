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
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── MUI ──
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ── Domain ──
import {
  aggregateExceptions,
  computeExceptionStats,
  detectAttentionUsers,
  detectCriticalHandoffs,
  detectMissingRecords,
  type ExceptionCategory,
} from '@/features/exceptions/domain/exceptionLogic';
import { ExceptionTable } from '@/features/exceptions/components/ExceptionTable';
import { useExceptionDataSources } from '@/features/exceptions/hooks/useExceptionDataSources';

// ─── Component ────────────────────────────────────────────────

export default function ExceptionCenterPage() {
  const navigate = useNavigate();

  // Sprint-1 Phase B: 実データ接続
  const dataSources = useExceptionDataSources();
  
  const [categoryFilter, setCategoryFilter] = useState<ExceptionCategory | 'all'>('all');

  // ── 例外検出（実データ） ──
  const exceptions = useMemo(() => {
    const missingRecords = detectMissingRecords({
      expectedUsers: dataSources.expectedUsers,
      existingRecords: dataSources.todayRecords,
      targetDate: dataSources.today,
    });

    const criticalHandoffs = detectCriticalHandoffs(dataSources.criticalHandoffs);

    const attentionUsers = detectAttentionUsers(dataSources.userSummaries);

    return aggregateExceptions(missingRecords, criticalHandoffs, attentionUsers);
  }, [dataSources]);

  const stats = useMemo(() => computeExceptionStats(exceptions), [exceptions]);

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
      key: 'total',
      label: '合計例外',
      count: stats.total,
      icon: '📊',
      color: stats.total > 0 ? '#f57c00' : '#2e7d32',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="exception-center-page">
      {/* ── Back Navigation ── */}
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate('/admin')}
        sx={{ mb: 2 }}
        data-testid="exception-center-back"
      >
        管理ツールに戻る
      </Button>

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
            gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' },
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
                onClick={() => setCategoryFilter(card.key === 'total' ? 'all' : card.key as ExceptionCategory)}
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
          items={exceptions}
          title="対応が必要な例外"
          showFilters
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
        />
      </Stack>
    </Container>
  );
}
