/**
 * SupportPlanningSheetPage — Read-only 表示コンポーネント
 *
 * ReadOnlyOverview + ReadOnlyRegulatory をページ外に分離。
 */
import React from 'react';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { SupportPlanningSheet } from '@/domain/isp/schema';
import { InfoRow } from '@/features/planning-sheet/components/ReadOnlySections';

// ─────────────────────────────────────────────
// ReadOnlyOverview
// ─────────────────────────────────────────────

export const ReadOnlyOverview: React.FC<{ sheet: SupportPlanningSheet }> = ({ sheet }) => (
  <Stack spacing={2}>
    <Typography variant="subtitle1" fontWeight={600}>基本情報</Typography>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <InfoRow label="タイトル" value={sheet.title} />
        <InfoRow label="対象場面" value={sheet.targetScene || '—'} />
        <InfoRow label="対象領域" value={sheet.targetDomain || '—'} />
        <Divider />
        <InfoRow label="行動観察" value={sheet.observationFacts} />
        <InfoRow label="収集情報" value={sheet.collectedInformation || '—'} />
        <InfoRow label="分析・仮説" value={sheet.interpretationHypothesis} />
        <InfoRow label="支援課題" value={sheet.supportIssues} />
        <Divider />
        <InfoRow label="対応方針" value={sheet.supportPolicy} />
        <InfoRow label="環境調整" value={sheet.environmentalAdjustments || '—'} />
        <InfoRow label="関わり方の具体策" value={sheet.concreteApproaches} />
      </Stack>
    </Paper>
  </Stack>
);

// ─────────────────────────────────────────────
// ReadOnlyRegulatory
// ─────────────────────────────────────────────

export const ReadOnlyRegulatory: React.FC<{ sheet: SupportPlanningSheet }> = ({ sheet }) => (
  <Stack spacing={2}>
    <Typography variant="subtitle1" fontWeight={600}>制度項目</Typography>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <InfoRow label="作成者ID" value={sheet.authoredByStaffId || '—'} />
        <InfoRow label="作成者資格" value={sheet.authoredByQualification} />
        <InfoRow label="作成日" value={sheet.authoredAt || '—'} />
        <InfoRow label="対象サービス" value={sheet.applicableServiceType} />
        <InfoRow label="対象加算" value={sheet.applicableAddOnTypes.join(', ')} />
        <Divider />
        <InfoRow label="利用者交付日" value={sheet.deliveredToUserAt || '未交付'} />
        <InfoRow label="見直し日" value={sheet.reviewedAt || '未見直し'} />
        <InfoRow label="適用開始日" value={sheet.appliedFrom || '—'} />
        <InfoRow label="次回見直し日" value={sheet.nextReviewAt || '—'} />
        <Divider />
        <InfoRow label="医療連携" value={sheet.hasMedicalCoordination ? 'あり' : 'なし'} />
        <InfoRow label="教育連携" value={sheet.hasEducationCoordination ? 'あり' : 'なし'} />
        {sheet.regulatoryBasisSnapshot && (
          <>
            <Typography variant="body2" fontWeight={500} sx={{ mt: 1 }}>対象者判定スナップショット</Typography>
            <InfoRow label="支援区分" value={sheet.regulatoryBasisSnapshot.supportLevel?.toString() ?? '—'} />
            <InfoRow label="行動関連項目" value={sheet.regulatoryBasisSnapshot.behaviorScore?.toString() ?? '—'} />
            <InfoRow label="確認日" value={sheet.regulatoryBasisSnapshot.eligibilityCheckedAt || '—'} />
          </>
        )}
      </Stack>
    </Paper>
  </Stack>
);
