/**
 * @fileoverview ExceptionCenterPage — 施設横断の例外監視センター
 * @description
 * 管理者・リーダー向け。
 * 個人の「今やること」を超えて、施設全体の支援不備・リスク放置・計画乖離を横断的に監視する。
 */
import React from 'react';
import { Box, Container, Stack, Typography, Paper, Chip } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useExceptionCenterOrchestrator } from '../../features/exceptions/hooks/useExceptionCenterOrchestrator';
import { ExceptionTable } from '@/features/exceptions/components/ExceptionTable';
import type { ExceptionSeverity } from '@/features/exceptions/domain/exceptionLogic';
import { useEscalationEvaluation } from '@/features/exceptions/hooks/useEscalationEvaluation';
import { EscalationAlertBanner } from '@/features/exceptions/components/EscalationAlertBanner';
import { useNotificationDispatcher } from '@/features/exceptions/hooks/useNotificationDispatcher';
import { DriftEventTable } from '@/features/diagnostics/drift/ui/DriftEventTable';
import { Tabs, Tab } from '@mui/material';
import { useSuggestionStateStore } from '@/features/action-engine/hooks/useSuggestionStateStore';
import { useAllCorrectiveActions } from '@/features/action-engine/hooks/useAllCorrectiveActions';
import { recordSuggestionTelemetry } from '@/features/action-engine/telemetry/recordSuggestionTelemetry';
import { 
  buildSuggestionTelemetryEvent, 
  SUGGESTION_TELEMETRY_EVENTS 
} from '@/features/action-engine/telemetry/buildSuggestionTelemetryEvent';
import { computeSnoozeUntil } from '@/features/action-engine/domain/computeSnoozeUntil';
import type { SnoozePreset } from '@/features/action-engine/domain/computeSnoozeUntil';
import type { SuggestionCtaSurface } from '@/features/exceptions/components/ExceptionTable.types';

const SEVERITY_LABELS: Record<ExceptionSeverity, string> = {
  critical: '致命的',
  high: '高',
  medium: '中',
  low: '低'
};

const SEVERITY_COLORS: Record<ExceptionSeverity, 'error' | 'warning' | 'primary' | 'success'> = {
  critical: 'error',
  high: 'warning',
  medium: 'primary',
  low: 'success'
};

export const ExceptionCenterPage: React.FC = () => {
  const { items, summary, isLoading, error } = useExceptionCenterOrchestrator();
  const { activeEscalations } = useEscalationEvaluation(items, summary);
  const { suggestions } = useAllCorrectiveActions();
  const dismissSuggestion = useSuggestionStateStore((s) => s.dismiss);
  const snoozeSuggestion = useSuggestionStateStore((s) => s.snooze);

  const handleDismiss = React.useCallback((stableId: string) => {
    const s = suggestions.find(x => x.stableId === stableId);
    const ruleId = s?.ruleId || stableId.split(':')[0] || 'unknown';
    const priority = s?.priority || 'P2';
    const targetUserId = s?.targetUserId || stableId.split(':')[1];

    recordSuggestionTelemetry(buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.DISMISSED,
      sourceScreen: 'exception-center',
      stableId,
      ruleId,
      priority,
      targetUserId
    }));
    dismissSuggestion(stableId, { by: 'exception-center' });
  }, [suggestions, dismissSuggestion]);

  const handleSnooze = React.useCallback((stableId: string, preset: SnoozePreset) => {
    const s = suggestions.find(x => x.stableId === stableId);
    const ruleId = s?.ruleId || stableId.split(':')[0] || 'unknown';
    const priority = s?.priority || 'P2';
    const targetUserId = s?.targetUserId || stableId.split(':')[1];
    const until = computeSnoozeUntil(preset, new Date());

    recordSuggestionTelemetry(buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.SNOOZED,
      sourceScreen: 'exception-center',
      stableId,
      ruleId,
      priority,
      targetUserId,
      snoozePreset: preset,
      snoozedUntil: until
    }));
    snoozeSuggestion(stableId, until, { by: 'exception-center' });
  }, [suggestions, snoozeSuggestion]);

  const handleCtaClick = React.useCallback((stableId: string, targetUrl: string, surface?: SuggestionCtaSurface) => {
    const s = suggestions.find(x => x.stableId === stableId);
    const ruleId = s?.ruleId || stableId.split(':')[0] || 'unknown';
    const priority = s?.priority || 'P2';
    const targetUserId = s?.targetUserId || stableId.split(':')[1];

    recordSuggestionTelemetry(buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
      sourceScreen: 'exception-center',
      stableId,
      ruleId,
      priority,
      targetUserId,
      targetUrl,
      ctaSurface: surface
    }));
  }, [suggestions]);

  const handlePriorityTopShown = React.useCallback((stableIds: string[]) => {
    for (const sid of stableIds) {
      const s = suggestions.find(x => x.stableId === sid);
      const ruleId = s?.ruleId || sid.split(':')[0] || 'unknown';
      const priority = s?.priority || 'P2';
      const targetUserId = s?.targetUserId || sid.split(':')[1];

      recordSuggestionTelemetry(buildSuggestionTelemetryEvent({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'exception-center',
        stableId: sid,
        ruleId,
        priority,
        targetUserId,
        ctaSurface: 'priority-top3'
      }));
    }
  }, [suggestions]);
  const [activeTab, setActiveTab] = React.useState(0);
  
  // 重要例外を外部チャネルへ配送
  const { historyCount } = useNotificationDispatcher(activeEscalations);

  if (isLoading) return <Box sx={{ p: 4 }}>読み込み中...</Box>;
  if (error) return <Box sx={{ p: 4 }}>エラー: {error}</Box>;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={4}>
        {/* Escalation Area */}
        <EscalationAlertBanner 
          activeEscalations={activeEscalations}
          onDismiss={(_id: string) => {}} 
          onActionClick={(_id: string) => {}}
        />

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              🛡️ Exception Center
            </Typography>
            <Typography variant="body1" color="text.secondary">
              施設全体の支援不備・リスク逸脱・計画乖離をリアルタイムに監視しています
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Chip 
              icon={<NotificationsActiveIcon sx={{ fontSize: '1rem !important' }} />}
              label={`通知チャネル稼働中 (${historyCount}件 送信済)`}
              color="success"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 700 }}
            />
          </Box>
        </Box>

        {/* Navigation Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_e, newValue) => setActiveTab(newValue)}>
            <Tab label="例外監視ボード" sx={{ fontWeight: 700 }} />
            <Tab label="SharePoint ドリフト履歴" sx={{ fontWeight: 700 }} />
          </Tabs>
        </Box>

        {activeTab === 0 ? (
          <Stack spacing={4}>
            {/* Stats Summary */}
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
              }}
            >
              <StatCard 
                title="未解消例外 合計" 
                value={summary.totalCount} 
                color="primary"
                description="現在検知されている全例外数"
              />
              <StatCard 
                title="致命的例外 (Critical)" 
                value={summary.stats.bySeverity.critical} 
                color="error"
                description="即時の介入が必要な異常"
              />
              <StatCard 
                title="重点監視利用者" 
                value={summary.highRiskUserIds.length} 
                color="warning"
                description="重大な不備が集中している利用者"
              />
              <StatCard 
                title="計画乖離 (Bridge)" 
                value={(summary.stats.byCategory['procedure-unperformed'] ?? 0) + (summary.stats.byCategory['risk-deviation'] ?? 0)} 
                color="info"
                description="計画と実績の不整合"
              />
            </Box>

            {/* Main Monitoring Board */}
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' },
              }}
            >
              {/* User Groups Breakdown */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  利用者別ステータス
                </Typography>
                <Stack spacing={1.5}>
                  {summary.groups.map(group => (
                    <Paper 
                      key={group.userId} 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5, 
                        borderRadius: 1.5,
                        borderLeft: 4,
                        borderLeftColor: `${SEVERITY_COLORS[group.maxSeverity] || 'primary'}.main`
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {group.userName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            例外 {group.items.length}件 
                            {group.criticalCount > 0 && ` (致命的 ${group.criticalCount}件)`}
                          </Typography>
                        </Box>
                        <Chip 
                          label={SEVERITY_LABELS[group.maxSeverity]} 
                          size="small" 
                          color={SEVERITY_COLORS[group.maxSeverity] || 'primary'}
                          variant="outlined"
                          sx={{ fontWeight: 700 }}
                        />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>

              {/* Detailed Exception Table */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <ExceptionTable 
                  items={items} 
                  title="全例外詳細（横断表示）"
                  suggestionActions={{
                    onDismiss: handleDismiss,
                    onSnooze: handleSnooze,
                    onCtaClick: handleCtaClick,
                    onPriorityTopShown: handlePriorityTopShown
                  }}
                />
              </Paper>
            </Box>
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 2 }}>
            <DriftEventTable />
          </Paper>
        )}
      </Stack>
    </Container>
  );
};

const StatCard: React.FC<{ title: string; value: number; color: string; description: string }> = ({ 
  title, value, color, description 
}) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderTop: 4, borderTopColor: `${color}.main` }}>
    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
      {title}
    </Typography>
    <Typography variant="h3" fontWeight={800} sx={{ my: 1 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {description}
    </Typography>
  </Paper>
);

export default ExceptionCenterPage;
