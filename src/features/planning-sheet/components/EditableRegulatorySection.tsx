/**
 * EditableRegulatorySection — 制度項目タブ（編集可能）
 *
 * usePlanningSheetForm の values / setFieldValue を受け取り、
 * 制度上の必須項目（資格・日付・サービス種別等）を編集可能にする。
 */
import type { PlanningSheetFormValues } from '@/domain/isp/schema';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { InfoRow } from './ReadOnlySections';

const SERVICE_TYPE_OPTIONS = [
  { value: 'daily_life_care', label: '生活介護' },
  { value: 'employment_a', label: '就労A' },
  { value: 'employment_b', label: '就労B' },
  { value: 'employment_transition', label: '就労移行' },
  { value: 'community_transition', label: '地域移行' },
  { value: 'community_living', label: '地域定着' },
  { value: 'short_stay', label: 'ショートステイ' },
  { value: 'group_home', label: 'グループホーム' },
  { value: 'home_care', label: '居宅介護' },
  { value: 'other', label: 'その他' },
] as const;

const QUALIFICATION_OPTIONS = [
  { value: 'behavior_support_specialist', label: '強度行動障害支援者' },
  { value: 'practical_training', label: '実践研修修了者' },
  { value: 'basic_training', label: '基礎研修修了者' },
  { value: 'service_manager', label: 'サービス管理責任者' },
  { value: 'social_worker', label: '社会福祉士' },
  { value: 'psw', label: '精神保健福祉士' },
  { value: 'nurse', label: '看護師' },
  { value: 'ot', label: '作業療法士' },
  { value: 'pt', label: '理学療法士' },
  { value: 'psychologist', label: '公認心理師' },
  { value: 'other', label: 'その他' },
  { value: 'unknown', label: '不明' },
] as const;

interface Props {
  values: PlanningSheetFormValues;
  sheet: SupportPlanningSheet;
  setFieldValue: <K extends keyof PlanningSheetFormValues>(
    field: K,
    value: PlanningSheetFormValues[K],
  ) => void;
}

export const EditableRegulatorySection: React.FC<Props> = ({ values, sheet, setFieldValue }) => (
  <Stack spacing={2.5}>
    <Typography variant="subtitle1" fontWeight={600}>制度項目</Typography>

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="作成者ID"
        value={values.authoredByStaffId}
        onChange={(e) => setFieldValue('authoredByStaffId', e.target.value)}
        fullWidth
        size="small"
      />
      <TextField
        label="作成者資格"
        value={values.authoredByQualification}
        onChange={(e) => setFieldValue('authoredByQualification', e.target.value as PlanningSheetFormValues['authoredByQualification'])}
        select
        fullWidth
        size="small"
      >
        {QUALIFICATION_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>
    </Stack>

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="作成日"
        type="date"
        value={values.authoredAt ?? ''}
        onChange={(e) => setFieldValue('authoredAt', e.target.value || undefined)}
        InputLabelProps={{ shrink: true }}
        fullWidth
        size="small"
      />
      <TextField
        label="対象サービス"
        value={values.applicableServiceType}
        onChange={(e) => setFieldValue('applicableServiceType', e.target.value as PlanningSheetFormValues['applicableServiceType'])}
        select
        fullWidth
        size="small"
      >
        {SERVICE_TYPE_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>
    </Stack>

    <Divider />

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="適用開始日"
        type="date"
        value={values.appliedFrom ?? ''}
        onChange={(e) => setFieldValue('appliedFrom', e.target.value || undefined)}
        InputLabelProps={{ shrink: true }}
        fullWidth
        size="small"
      />
      <TextField
        label="次回見直し日"
        type="date"
        value={values.nextReviewAt ?? ''}
        onChange={(e) => setFieldValue('nextReviewAt', e.target.value || undefined)}
        InputLabelProps={{ shrink: true }}
        fullWidth
        size="small"
      />
    </Stack>

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="利用者交付日"
        type="date"
        value={values.deliveredToUserAt ?? ''}
        onChange={(e) => setFieldValue('deliveredToUserAt', e.target.value || undefined)}
        InputLabelProps={{ shrink: true }}
        fullWidth
        size="small"
      />
      <TextField
        label="見直し日"
        type="date"
        value={values.reviewedAt ?? ''}
        onChange={(e) => setFieldValue('reviewedAt', e.target.value || undefined)}
        InputLabelProps={{ shrink: true }}
        fullWidth
        size="small"
      />
    </Stack>

    <Divider />

    <Stack direction="row" spacing={3}>
      <FormControlLabel
        control={
          <Checkbox
            checked={values.hasMedicalCoordination}
            onChange={(e) => setFieldValue('hasMedicalCoordination', e.target.checked)}
          />
        }
        label="医療連携あり"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={values.hasEducationCoordination}
            onChange={(e) => setFieldValue('hasEducationCoordination', e.target.checked)}
          />
        }
        label="教育連携あり"
      />
    </Stack>

    {/* 対象者判定スナップショット（read-only — 自動生成） */}
    {sheet.regulatoryBasisSnapshot && (
      <Stack spacing={1}>
        <Typography variant="body2" fontWeight={500} sx={{ mt: 1 }}>
          対象者判定スナップショット（自動記録）
        </Typography>
        <InfoRow label="支援区分" value={sheet.regulatoryBasisSnapshot.supportLevel?.toString() ?? '—'} />
        <InfoRow label="行動関連項目" value={sheet.regulatoryBasisSnapshot.behaviorScore?.toString() ?? '—'} />
        <InfoRow label="確認日" value={sheet.regulatoryBasisSnapshot.eligibilityCheckedAt || '—'} />
      </Stack>
    )}
  </Stack>
);
