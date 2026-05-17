import React from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import { SectionTitle } from '../components/SectionTitle';
import { IcebergIllustration } from '../components/illustrations/IcebergIllustration';
import { ABCIllustration } from '../components/illustrations/ABCIllustration';
import type { FormState } from '../types';
import { ICEBERG_FACTORS, BEHAVIOR_FUNCTIONS } from '../constants';

interface SectionAnalysisAndFbaProps {
  step: number;
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  renderProvenanceBadge: (fieldKey: string) => React.ReactNode;
}

export const SectionAnalysisAndFba: React.FC<SectionAnalysisAndFbaProps> = ({
  step,
  form,
  updateField,
  renderProvenanceBadge,
}) => {
  if (step === 2) {
    // §3 氷山分析
    return (
      <Stack spacing={2}>
        <SectionTitle number={3} title="行動の背景（氷山分析）" desc="行動の水面下にある要因を構造化して分析する" />
        <IcebergIllustration surfaceValue={form.icebergSurface} />

        {ICEBERG_FACTORS.map(f => {
          const fieldKey = f.key as keyof FormState;
          return (
            <Stack key={f.key} spacing={0.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>{f.icon} {f.label}</Typography>
                {renderProvenanceBadge(f.key)}
              </Box>
              <TextField
                value={String(form[fieldKey] || '')}
                onChange={e => updateField(fieldKey, e.target.value)}
                fullWidth
                multiline
                minRows={2}
                placeholder={f.placeholder}
              />
            </Stack>
          );
        })}
      </Stack>
    );
  }

  // §4 FBA
  return (
    <Stack spacing={2}>
      <SectionTitle number={4} title="行動機能分析（FBA）" desc="行動の「機能（目的）」を特定し、ABC記録で裏付ける" />
      
      <ABCIllustration 
        a={form.abcAntecedent} 
        b={form.abcBehavior} 
        c={form.abcConsequence} 
      />

      <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2 }}>行動の機能（複数選択可）</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {BEHAVIOR_FUNCTIONS.map(bf => (
          <FormControlLabel key={bf.value} control={
            <Checkbox
              checked={form.behaviorFunctions.includes(bf.value)}
              onChange={e => {
                const next = e.target.checked
                  ? [...form.behaviorFunctions, bf.value]
                  : form.behaviorFunctions.filter(v => v !== bf.value);
                updateField('behaviorFunctions', next);
              }}
            />
          } label={bf.label} />
        ))}
      </Stack>
      <TextField label="機能の詳細分析" value={form.behaviorFunctionDetail} onChange={e => updateField('behaviorFunctionDetail', e.target.value)} fullWidth multiline minRows={3}
        placeholder="なぜこの機能と判断したか、根拠を記載" />

      <Divider textAlign="left"><Chip label="ABC 記録" size="small" /></Divider>
      <TextField label="A: 先行事象（Antecedent）" value={form.abcAntecedent} onChange={e => updateField('abcAntecedent', e.target.value)} fullWidth multiline minRows={2}
        placeholder="行動の直前に何が起きたか" />
      <TextField label="B: 行動（Behavior）" value={form.abcBehavior} onChange={e => updateField('abcBehavior', e.target.value)} fullWidth multiline minRows={2}
        placeholder="具体的にどのような行動が見られたか" />
      <TextField label="C: 結果（Consequence）" value={form.abcConsequence} onChange={e => updateField('abcConsequence', e.target.value)} fullWidth multiline minRows={2}
        placeholder="行動の結果何が起きたか（環境がどう変化したか）" />
    </Stack>
  );
};
