/**
 * EditableOverviewSection — 概要タブ（編集可能）
 *
 * usePlanningSheetForm の values / setFieldValue を受け取り、
 * フォーム入力を提供する。
 */
import type { PlanningSheetFormValues } from '@/domain/isp/schema';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import { ProvenanceBadgeGroup } from '@/features/planning-sheet/components/ProvenanceBadge';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';

interface Props {
  values: PlanningSheetFormValues;
  setFieldValue: <K extends keyof PlanningSheetFormValues>(
    field: K,
    value: PlanningSheetFormValues[K],
  ) => void;
  errors: Partial<Record<keyof PlanningSheetFormValues, string>>;
  /** 出典追跡エントリ（省略可能 — 取込がない場合はバッジ非表示） */
  provenanceEntries?: ProvenanceEntry[];
}

export const EditableOverviewSection: React.FC<Props> = ({ values, setFieldValue, errors, provenanceEntries = [] }) => (
  <Stack spacing={2.5}>
    <Typography variant="subtitle1" fontWeight={600}>基本情報</Typography>

    <TextField
      label="タイトル"
      value={values.title}
      onChange={(e) => setFieldValue('title', e.target.value)}
      error={!!errors.title}
      helperText={errors.title}
      fullWidth
      required
      size="small"
    />

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="対象場面"
        value={values.targetScene}
        onChange={(e) => setFieldValue('targetScene', e.target.value)}
        fullWidth
        size="small"
      />
      <TextField
        label="対象領域"
        value={values.targetDomain}
        onChange={(e) => setFieldValue('targetDomain', e.target.value)}
        fullWidth
        size="small"
      />
    </Stack>

    <Divider />

    <Box>
      <TextField
        label="行動観察"
        value={values.observationFacts}
        onChange={(e) => setFieldValue('observationFacts', e.target.value)}
        error={!!errors.observationFacts}
        helperText={errors.observationFacts}
        fullWidth
        required
        multiline
        minRows={2}
        size="small"
      />
      <ProvenanceBadgeGroup field="observationFacts" entries={provenanceEntries} />
    </Box>

    <Box>
      <TextField
        label="収集情報"
        value={values.collectedInformation}
        onChange={(e) => setFieldValue('collectedInformation', e.target.value)}
        fullWidth
        multiline
        minRows={2}
        size="small"
      />
      <ProvenanceBadgeGroup field="collectedInformation" entries={provenanceEntries} />
    </Box>

    <TextField
      label="分析・仮説"
      value={values.interpretationHypothesis}
      onChange={(e) => setFieldValue('interpretationHypothesis', e.target.value)}
      error={!!errors.interpretationHypothesis}
      helperText={errors.interpretationHypothesis}
      fullWidth
      required
      multiline
      minRows={2}
      size="small"
    />

    <TextField
      label="支援課題"
      value={values.supportIssues}
      onChange={(e) => setFieldValue('supportIssues', e.target.value)}
      error={!!errors.supportIssues}
      helperText={errors.supportIssues}
      fullWidth
      required
      multiline
      minRows={2}
      size="small"
    />

    <Divider />

    <Box>
      <TextField
        label="対応方針"
        value={values.supportPolicy}
        onChange={(e) => setFieldValue('supportPolicy', e.target.value)}
        error={!!errors.supportPolicy}
        helperText={errors.supportPolicy}
        fullWidth
        required
        multiline
        minRows={2}
        size="small"
      />
      <ProvenanceBadgeGroup field="supportPolicy" entries={provenanceEntries} />
    </Box>

    <Box>
      <TextField
        label="環境調整"
        value={values.environmentalAdjustments}
        onChange={(e) => setFieldValue('environmentalAdjustments', e.target.value)}
        fullWidth
        multiline
        minRows={2}
        size="small"
      />
      <ProvenanceBadgeGroup field="environmentalAdjustments" entries={provenanceEntries} />
    </Box>

    <Box>
      <TextField
        label="関わり方の具体策"
        value={values.concreteApproaches}
        onChange={(e) => setFieldValue('concreteApproaches', e.target.value)}
        error={!!errors.concreteApproaches}
        helperText={errors.concreteApproaches}
        fullWidth
        required
        multiline
        minRows={2}
        size="small"
      />
      <ProvenanceBadgeGroup field="concreteApproaches" entries={provenanceEntries} />
    </Box>
  </Stack>
);
