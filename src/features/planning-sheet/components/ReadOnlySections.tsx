/**
 * PlanningSheet Section Components — read-only 表示コンポーネント
 *
 * Intake / Assessment / Planning の構造化データ（配列）は
 * read-only 表示。将来的にインライン編集に拡張予定。
 *
 * @see src/pages/SupportPlanningSheetPage.tsx
 */
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { EvidenceLinkMap, EvidenceLinkType } from '@/domain/isp/evidenceLink';
import { EvidenceLinksDisplay } from './EvidenceLinkSelector';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type React from 'react';

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

export const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Stack direction="row" spacing={1} alignItems="baseline">
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140, flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{value}</Typography>
  </Stack>
);

export const ChipRow: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <Stack spacing={0.5}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {items.length > 0
        ? items.map((item, i) => <Chip key={i} size="small" label={item} variant="outlined" />)
        : <Typography variant="caption" color="text.disabled">—</Typography>}
    </Stack>
  </Stack>
);

// ─────────────────────────────────────────────
// IntakeSection (read-only)
// ─────────────────────────────────────────────

export const IntakeSection: React.FC<{ sheet: SupportPlanningSheet }> = ({ sheet }) => {
  const { intake } = sheet;
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight={600}>情報収集（インテーク）</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <InfoRow label="主訴" value={intake.presentingProblem || '—'} />
          <InfoRow label="行動関連項目合計点" value={intake.behaviorItemsTotal?.toString() ?? '—'} />
          <InfoRow label="直近30日インシデント" value={intake.incidentSummaryLast30d || '—'} />
          {intake.targetBehaviorsDraft.length > 0 && (
            <>
              <Typography variant="body2" fontWeight={500} sx={{ mt: 1 }}>対象行動の下書き</Typography>
              {intake.targetBehaviorsDraft.map((b, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" fontWeight={500}>{b.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{b.description} / 頻度: {b.frequency}</Typography>
                </Paper>
              ))}
            </>
          )}
          <ChipRow label="コミュニケーション手段" items={intake.communicationModes} />
          <ChipRow label="感覚トリガー" items={intake.sensoryTriggers} />
          <ChipRow label="医療フラグ" items={intake.medicalFlags} />
        </Stack>
      </Paper>
    </Stack>
  );
};

// ─────────────────────────────────────────────
// AssessmentSection (read-only)
// ─────────────────────────────────────────────

export const AssessmentSection: React.FC<{ sheet: SupportPlanningSheet }> = ({ sheet }) => {
  const { assessment } = sheet;
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight={600}>アセスメント</Typography>
      {assessment.targetBehaviors.map((b, i) => (
        <Paper key={i} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" fontWeight={600}>{b.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            操作的定義: {b.operationalDefinition}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="caption">頻度: {b.frequency}</Typography>
            <Typography variant="caption">強度: {b.intensity}</Typography>
            <Typography variant="caption">持続: {b.duration}</Typography>
          </Stack>
        </Paper>
      ))}
      {assessment.abcEvents.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={500}>ABC 観察記録</Typography>
          {assessment.abcEvents.map((e, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={0.5}>
                <Typography variant="body2"><strong>A:</strong> {e.antecedent}</Typography>
                <Typography variant="body2"><strong>B:</strong> {e.behavior}</Typography>
                <Typography variant="body2"><strong>C:</strong> {e.consequence}</Typography>
                {e.date && <Typography variant="caption" color="text.secondary">日付: {e.date}</Typography>}
              </Stack>
            </Paper>
          ))}
        </>
      )}
      {assessment.hypotheses.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={500}>行動機能仮説</Typography>
          {assessment.hypotheses.map((h, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2">機能: {h.function}</Typography>
              <Typography variant="body2" color="text.secondary">根拠: {h.evidence}</Typography>
              <Chip size="small" label={`確信度: ${h.confidence}`} sx={{ mt: 0.5 }} />
            </Paper>
          ))}
        </>
      )}
      <InfoRow label="リスクレベル" value={assessment.riskLevel} />
      <InfoRow label="チーム合意メモ" value={assessment.teamConsensusNote || '—'} />
    </Stack>
  );
};

// ─────────────────────────────────────────────
// PlanningDesignSection (read-only)
// ─────────────────────────────────────────────

export const PlanningDesignSection: React.FC<{
  sheet: SupportPlanningSheet;
  evidenceLinks?: EvidenceLinkMap;
  onEvidenceClick?: (type: EvidenceLinkType, referenceId: string) => void;
}> = ({ sheet, evidenceLinks, onEvidenceClick }) => {
  const { planning } = sheet;
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight={600}>支援設計</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <ChipRow label="支援課題の優先順位" items={planning.supportPriorities} />
          <ChipRow label="先行事象戦略（予防的支援）" items={planning.antecedentStrategies} />
          {evidenceLinks && <EvidenceLinksDisplay sectionLabel="先行事象戦略" links={evidenceLinks.antecedentStrategies} onEvidenceClick={onEvidenceClick} />}
          <ChipRow label="教授戦略（代替行動）" items={planning.teachingStrategies} />
          {evidenceLinks && <EvidenceLinksDisplay sectionLabel="教授戦略" links={evidenceLinks.teachingStrategies} onEvidenceClick={onEvidenceClick} />}
          <ChipRow label="後続事象戦略（危機対応）" items={planning.consequenceStrategies} />
          {evidenceLinks && <EvidenceLinksDisplay sectionLabel="後続事象戦略" links={evidenceLinks.consequenceStrategies} onEvidenceClick={onEvidenceClick} />}
        </Stack>
      </Paper>
      {planning.procedureSteps.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={500}>支援手順</Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              {planning.procedureSteps.map((step) => (
                <Stack key={step.order} direction="row" spacing={2} alignItems="baseline">
                  <Chip size="small" label={`${step.order}`} variant="outlined" sx={{ minWidth: 28 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{step.instruction}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {step.staff && `担当: ${step.staff}`}
                      {step.timing && ` ／ タイミング: ${step.timing}`}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </>
      )}
      <InfoRow label="見直し周期" value={`${planning.reviewCycleDays}日`} />
    </Stack>
  );
};
