import React from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { SectionTitle } from '../components/SectionTitle';
import type { FormState } from '../types';
import { TRAINING_LEVELS } from '../constants';
import { calculateMonitoringSchedule } from '@/features/planning-sheet/monitoringSchedule';

interface SectionBasicAndTargetProps {
  step: number;
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

export const SectionBasicAndTarget: React.FC<SectionBasicAndTargetProps> = ({
  step,
  form,
  updateField,
}) => {
  const schedule = React.useMemo(() => {
    if (!form.supportStartDate) return null;
    return calculateMonitoringSchedule(form.supportStartDate, form.monitoringCycleDays);
  }, [form.supportStartDate, form.monitoringCycleDays]);

  const schedulePreview = schedule ? (
    <Alert icon={false} severity="info" sx={{ mt: 1, py: 0.5, px: 2, border: '1px solid #93c5fd', bgcolor: '#eff6ff', borderRadius: 2 }}>
      <Typography variant="caption" color="primary.main" fontWeight={800}>
        🗓️ 次回予定日: {schedule.nextMonitoringDate} （{form.monitoringCycleDays}日周期）
      </Typography>
    </Alert>
  ) : null;

  if (step === 0) {
    // §1 基本情報
    return (
      <Stack spacing={2}>
        <SectionTitle number={1} title="基本情報" desc="利用者の基本情報と計画の概要" />
        <TextField label="計画タイトル" value={form.title} onChange={e => updateField('title', e.target.value)} required fullWidth
          placeholder="例: 外出活動場面における行動支援計画" />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="支援区分" value={form.supportLevel} onChange={e => updateField('supportLevel', e.target.value)} fullWidth
            placeholder="例: 区分5" />
          <TextField label="行動関連項目点数" value={form.behaviorScore} onChange={e => updateField('behaviorScore', e.target.value)} fullWidth
            placeholder="例: 18点" />
        </Stack>
        <TextField label="計画期間" value={form.planPeriod} onChange={e => updateField('planPeriod', e.target.value)} fullWidth
          placeholder="例: 2026年4月1日 〜 2026年9月30日" />
        <TextField
          label="支援開始日（モニタリング起点）"
          type="date"
          value={form.supportStartDate}
          onChange={e => updateField('supportStartDate', e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
          helperText="90日モニタリングの起点となる日付です。通常は利用開始日を設定します。"
        />
        {schedulePreview}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select label="関与研修" value={form.trainingLevel} onChange={e => updateField('trainingLevel', e.target.value)} fullWidth>
            {TRAINING_LEVELS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          <TextField label="関係機関" value={form.relatedOrganizations} onChange={e => updateField('relatedOrganizations', e.target.value)} fullWidth
            placeholder="例: 相談支援センター、訪問看護" />
        </Stack>
        {form.trainingLevel !== 'なし' && (
          <Alert severity="info" variant="outlined">
            ✅ 強度行動障害支援者養成研修（{form.trainingLevel}）修了者が関与 — 加算算定要件を充足
          </Alert>
        )}
      </Stack>
    );
  }

  // §2 対象行動
  return (
    <Stack spacing={2}>
      <SectionTitle number={2} title="対象行動（ターゲット行動）" desc="支援の対象となる行動を操作的に定義する" />
      <TextField label="対象行動" value={form.targetBehavior} onChange={e => updateField('targetBehavior', e.target.value)} required fullWidth multiline minRows={2}
        placeholder="例: 外出活動前に大声で拒否し床に座り込む" />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label="発生頻度" value={form.behaviorFrequency} onChange={e => updateField('behaviorFrequency', e.target.value)} fullWidth
          placeholder="例: 週3〜4回" />
        <TextField label="継続時間" value={form.behaviorDuration} onChange={e => updateField('behaviorDuration', e.target.value)} fullWidth
          placeholder="例: 5〜20分" />
      </Stack>
      <TextField label="発生場面" value={form.behaviorSituation} onChange={e => updateField('behaviorSituation', e.target.value)} fullWidth multiline minRows={2}
        placeholder="いつ・どこで・どのような状況で発生するか" />
      <TextField label="強度" value={form.behaviorIntensity} onChange={e => updateField('behaviorIntensity', e.target.value)} fullWidth
        placeholder="例: 大声（70dB程度）、床への座り込み" />
      <TextField label="危険性" value={form.behaviorRisk} onChange={e => updateField('behaviorRisk', e.target.value)} fullWidth
        placeholder="本人: / 他者:" />
      <TextField label="影響" value={form.behaviorImpact} onChange={e => updateField('behaviorImpact', e.target.value)} fullWidth multiline minRows={2}
        placeholder="他利用者・職員・環境への影響" />
    </Stack>
  );
};
