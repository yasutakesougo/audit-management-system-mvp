import React from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { SectionTitle } from '../components/SectionTitle';
import type { FormState } from '../types';

interface SectionSharingProps {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

export const SectionSharing: React.FC<SectionSharingProps> = ({
  form,
  updateField,
}) => {
  return (
    <Stack spacing={2}>
      <SectionTitle number={10} title="チーム共有" desc="支援チーム全体で計画を共有し実行する体制" />
      <TextField label="共有方法" value={form.sharingMethod} onChange={e => updateField('sharingMethod', e.target.value)} fullWidth multiline minRows={2}
        placeholder="朝礼、週1回会議、計画掲示" />
      <TextField label="研修計画" value={form.training} onChange={e => updateField('training', e.target.value)} fullWidth multiline minRows={2}
        placeholder="OJT、事例検討会、外部研修" />
      <TextField label="担当者" value={form.personInCharge} onChange={e => updateField('personInCharge', e.target.value)} fullWidth
        placeholder="主担当 / 副担当" />
      <TextField label="確認日" value={form.confirmationDate} onChange={e => updateField('confirmationDate', e.target.value)} fullWidth
        placeholder="計画確認日" />
      <TextField label="チーム合意事項" value={form.teamConsensusNote} onChange={e => updateField('teamConsensusNote', e.target.value)} fullWidth multiline minRows={3}
        placeholder="チームで共有すべき方針・留意点" />
    </Stack>
  );
};
