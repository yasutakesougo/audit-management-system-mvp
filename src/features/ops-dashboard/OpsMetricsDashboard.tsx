/**
 * @fileoverview OpsMetricsDashboard — 運用指標ダッシュボード
 * @description
 * 5 枚の KPI カードで運用状態を可視化する。
 *
 * 2 つのモードで動作:
 * - demo=true: 内蔵サンプルデータ
 * - demo=false: useOpsMetrics() の出力を直接渡す
 */
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

import { computeProposalMetrics } from '@/domain/metrics/proposalMetrics';
import type { ProposalMetricsResult, ProposalDecisionRecord, MetricsPeriod } from '@/domain/metrics/proposalMetrics';
import { computePdcaCycleMetrics } from '@/domain/metrics/pdcaCycleMetrics';
import type { PdcaCycleMetricsResult, PdcaCycleRecord } from '@/domain/metrics/pdcaCycleMetrics';
import { computeKnowledgeMetrics } from '@/domain/metrics/knowledgeMetrics';
import type { KnowledgeMetricsResult, DecisionRecord, EvidenceLinkRecord, KnowledgePeriod } from '@/domain/metrics/knowledgeMetrics';

import ProposalAdoptionCard from './components/ProposalAdoptionCard';
import PdcaCycleHealthCard from './components/PdcaCycleHealthCard';
import CycleSpeedCard from './components/CycleSpeedCard';
import CycleAlertsCard from './components/CycleAlertsCard';
import KnowledgeGrowthCard from './components/KnowledgeGrowthCard';

// ─── Props ───────────────────────────────────────────────

export interface OpsMetricsDashboardProps {
  /** デモモード */
  demo?: boolean;

  // ── 計算済みメトリクス（useOpsMetrics の出力をそのまま渡す）──
  /** 計算済み Proposal Metrics */
  proposalMetrics?: ProposalMetricsResult | null;
  /** 計算済み PDCA Metrics */
  pdcaMetrics?: PdcaCycleMetricsResult | null;
  /** 計算済み Knowledge Metrics */
  knowledgeMetrics?: KnowledgeMetricsResult | null;
  /** schedule 未設定で除外された利用者数 */
  excludedUserCount?: number;

  // ── デモモード用の生データ props（後方互換）──
  proposalRecords?: ProposalDecisionRecord[];
  period?: MetricsPeriod;
  cycleRecords?: PdcaCycleRecord[];
  today?: string;
  decisionRecords?: DecisionRecord[];
  evidenceLinks?: EvidenceLinkRecord[];
  planningSheetIds?: string[];
  knowledgePeriod?: KnowledgePeriod;
}

// ─── デモデータ ──────────────────────────────────────────

const DEMO_PERIOD: MetricsPeriod = {
  start: '2026-02-01',
  end: '2026-02-28',
};

const DEMO_PROPOSAL_RECORDS: ProposalDecisionRecord[] = [
  { proposalId: 'h-01', source: 'handoff', urgency: 'recommended', action: 'accepted', selectedFields: ['supportPolicy', 'environmentalAdjustment'], generatedAt: '2026-02-05T09:00:00Z', decidedAt: '2026-02-06T14:00:00Z' },
  { proposalId: 'h-02', source: 'handoff', urgency: 'suggested', action: 'accepted', selectedFields: ['preSupport'], generatedAt: '2026-02-10T09:00:00Z', decidedAt: '2026-02-10T15:00:00Z' },
  { proposalId: 'h-03', source: 'handoff', urgency: 'urgent', action: 'accepted', selectedFields: ['emergencyResponse', 'crisisSupport'], generatedAt: '2026-02-15T09:00:00Z', decidedAt: '2026-02-15T10:00:00Z' },
  { proposalId: 'h-04', source: 'handoff', urgency: 'recommended', action: 'dismissed', dismissReason: 'already_addressed', generatedAt: '2026-02-18T09:00:00Z', decidedAt: '2026-02-19T09:00:00Z' },
  { proposalId: 'h-05', source: 'handoff', urgency: 'suggested', action: 'deferred', generatedAt: '2026-02-22T09:00:00Z', decidedAt: '2026-02-25T09:00:00Z' },
  { proposalId: 'a-01', source: 'abc', urgency: 'urgent', action: 'accepted', selectedFields: ['environmentalAdjustment'], generatedAt: '2026-02-08T09:00:00Z', decidedAt: '2026-02-09T09:00:00Z' },
  { proposalId: 'a-02', source: 'abc', urgency: 'recommended', action: 'accepted', selectedFields: ['evaluationIndicator'], generatedAt: '2026-02-12T09:00:00Z', decidedAt: '2026-02-14T09:00:00Z' },
  { proposalId: 'a-03', source: 'abc', urgency: 'recommended', action: 'dismissed', dismissReason: 'not_applicable', generatedAt: '2026-02-20T09:00:00Z', decidedAt: '2026-02-21T09:00:00Z' },
  { proposalId: 'm-01', source: 'monitoring', urgency: 'recommended', action: 'accepted', selectedFields: ['supportPolicy', 'goalRevision', 'environmentalAdjustment'], generatedAt: '2026-02-01T09:00:00Z', decidedAt: '2026-02-03T09:00:00Z' },
  { proposalId: 'm-02', source: 'monitoring', urgency: 'suggested', action: 'dismissed', dismissReason: 'insufficient_data', generatedAt: '2026-02-25T09:00:00Z', decidedAt: '2026-02-26T09:00:00Z' },
];

const DEMO_TODAY = '2026-03-15T00:00:00Z';

const DEMO_CYCLE_RECORDS: PdcaCycleRecord[] = [
  { cycleId: 'A-c1', userId: 'user-A', startedAt: '2025-12-01T00:00:00Z', dueAt: '2026-03-01T00:00:00Z', proposalAcceptedAt: '2026-02-10T00:00:00Z', reviewScheduledAt: '2026-02-20T00:00:00Z', reviewCompletedAt: '2026-02-22T00:00:00Z', planUpdatedAt: '2026-02-24T00:00:00Z' },
  { cycleId: 'B-c1', userId: 'user-B', startedAt: '2025-12-15T00:00:00Z', dueAt: '2026-03-15T00:00:00Z', proposalAcceptedAt: '2026-02-20T00:00:00Z', reviewScheduledAt: '2026-03-01T00:00:00Z', reviewCompletedAt: '2026-03-05T00:00:00Z', planUpdatedAt: '2026-03-10T00:00:00Z' },
  { cycleId: 'C-c1', userId: 'user-C', startedAt: '2025-12-01T00:00:00Z', dueAt: '2026-03-01T00:00:00Z', reviewScheduledAt: '2026-02-25T00:00:00Z' },
  { cycleId: 'D-c1', userId: 'user-D', startedAt: '2026-01-15T00:00:00Z', dueAt: '2026-04-15T00:00:00Z', proposalAcceptedAt: '2026-03-10T00:00:00Z', reviewScheduledAt: '2026-03-20T00:00:00Z' },
  { cycleId: 'E-c1', userId: 'user-E', startedAt: '2026-01-01T00:00:00Z', dueAt: '2026-04-01T00:00:00Z', proposalAcceptedAt: '2026-02-20T00:00:00Z', reviewScheduledAt: '2026-03-10T00:00:00Z' },
];

const DEMO_DECISION_RECORDS: DecisionRecord[] = [
  { id: 'h-1', source: 'handoff', action: 'accepted', rulePrefix: 'highCoOccurrence', decidedAt: '2026-02-06T14:00:00Z' },
  { id: 'h-2', source: 'handoff', action: 'accepted', rulePrefix: 'highCoOccurrence', decidedAt: '2026-02-10T15:00:00Z' },
  { id: 'h-3', source: 'handoff', action: 'accepted', rulePrefix: 'highCoOccurrence', decidedAt: '2026-02-15T10:00:00Z' },
  { id: 'h-4', source: 'handoff', action: 'dismissed', rulePrefix: 'slotBias', dismissReason: 'already_addressed', decidedAt: '2026-02-19T09:00:00Z' },
  { id: 'a-1', source: 'abc', action: 'accepted', rulePrefix: 'slotBias', decidedAt: '2026-02-09T09:00:00Z' },
  { id: 'a-2', source: 'abc', action: 'accepted', rulePrefix: 'tagDensityGap', decidedAt: '2026-02-14T09:00:00Z' },
  { id: 'a-3', source: 'abc', action: 'dismissed', rulePrefix: 'tagDensityGap', decidedAt: '2026-02-21T09:00:00Z' },
  { id: 'm-1', source: 'monitoring', action: 'accepted', rulePrefix: 'positiveSignal', decidedAt: '2026-02-03T09:00:00Z' },
  { id: 'm-2', source: 'monitoring', action: 'dismissed', rulePrefix: 'positiveSignal', dismissReason: 'insufficient_data', decidedAt: '2026-02-26T09:00:00Z' },
];

const DEMO_EVIDENCE_LINKS: EvidenceLinkRecord[] = [
  { planningSheetId: 'ps-1', linkType: 'abc', targetId: 'abc-001' },
  { planningSheetId: 'ps-1', linkType: 'abc', targetId: 'abc-002' },
  { planningSheetId: 'ps-1', linkType: 'pdca', targetId: 'pdca-001' },
  { planningSheetId: 'ps-2', linkType: 'abc', targetId: 'abc-003' },
  { planningSheetId: 'ps-3', linkType: 'pdca', targetId: 'pdca-002' },
];

const DEMO_SHEET_IDS = ['ps-1', 'ps-2', 'ps-3', 'ps-4', 'ps-5'];
const DEMO_KNOWLEDGE_PERIOD: KnowledgePeriod = { start: '2026-01-01', end: '2026-03-31', months: 3 };

// ─── コンポーネント ──────────────────────────────────────

const OpsMetricsDashboard: React.FC<OpsMetricsDashboardProps> = (props) => {
  const { demo = false } = props;

  // ── デモモード: 内蔵データから計算 ──
  const demoProposalMetrics = useMemo(
    () => demo ? computeProposalMetrics(DEMO_PROPOSAL_RECORDS, DEMO_PERIOD) : null,
    [demo],
  );
  const demoPdcaMetrics = useMemo(
    () => demo ? computePdcaCycleMetrics(DEMO_CYCLE_RECORDS, DEMO_TODAY) : null,
    [demo],
  );
  const demoKnowledgeMetrics = useMemo(
    () => demo ? computeKnowledgeMetrics(DEMO_DECISION_RECORDS, DEMO_EVIDENCE_LINKS, DEMO_SHEET_IDS, DEMO_KNOWLEDGE_PERIOD) : null,
    [demo],
  );

  // ── 最終値: props 優先、なければデモ ──
  const proposalMetrics = demo ? demoProposalMetrics : (props.proposalMetrics ?? null);
  const pdcaMetrics = demo ? demoPdcaMetrics : (props.pdcaMetrics ?? null);
  const knowledgeMetrics = demo ? demoKnowledgeMetrics : (props.knowledgeMetrics ?? null);
  const excludedUserCount = props.excludedUserCount ?? 0;

  return (
    <Box>
      {/* ヘッダー */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <AssessmentOutlinedIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Support Operations Metrics
        </Typography>
        {demo && (
          <Typography
            variant="caption"
            sx={{
              ml: 1,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'info.main',
              color: 'info.contrastText',
              fontWeight: 600,
            }}
          >
            DEMO
          </Typography>
        )}
        {!demo && excludedUserCount > 0 && (
          <Chip
            label={`${excludedUserCount}名 計測対象外`}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ ml: 1 }}
          />
        )}
      </Stack>

      {/* 5 カードグリッド: 上段 3 + 下段 2 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 2,
        }}
      >
        <ProposalAdoptionCard metrics={proposalMetrics} />
        <PdcaCycleHealthCard metrics={pdcaMetrics} />
        <CycleSpeedCard metrics={pdcaMetrics} />
        <KnowledgeGrowthCard metrics={knowledgeMetrics} />
        <CycleAlertsCard metrics={pdcaMetrics} />
      </Box>
    </Box>
  );
};

export default React.memo(OpsMetricsDashboard);
