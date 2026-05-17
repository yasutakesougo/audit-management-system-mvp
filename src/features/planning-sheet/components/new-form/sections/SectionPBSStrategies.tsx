import React from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { SectionTitle } from '../components/SectionTitle';
import { ResponseProtocolVisualizer } from '../components/illustrations/ResponseProtocolVisualizer';
import type { FormState } from '../types';

interface SectionPBSStrategiesProps {
  step: number;
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

export const SectionPBSStrategies: React.FC<SectionPBSStrategiesProps> = ({
  step,
  form,
  updateField,
}) => {
  if (step === 4) {
    // §5 予防的支援
    return (
      <Stack spacing={2}>
        <SectionTitle number={5} title="予防的支援（最重要）" desc="問題行動が起きる前に環境や関わり方を調整する" />
        <Alert severity="info" variant="outlined" sx={{ mb: 1 }}>
          💡 PBS では「問題行動を起こさせない環境づくり」が最も重要です
        </Alert>
        <TextField label="環境調整" value={form.environmentalAdjustment} onChange={e => updateField('environmentalAdjustment', e.target.value)} required fullWidth multiline minRows={2}
          placeholder="物理的環境の変更（レイアウト、刺激の調整）" />
        <TextField label="見通し支援" value={form.visualSupport} onChange={e => updateField('visualSupport', e.target.value)} required fullWidth multiline minRows={2}
          placeholder="スケジュールカード、写真提示、タイマー" />
        <TextField label="コミュニケーション支援" value={form.communicationSupport} onChange={e => updateField('communicationSupport', e.target.value)} fullWidth multiline minRows={2}
          placeholder="絵カード、PECS、サイン" />
        <TextField label="安心支援" value={form.safetySupport} onChange={e => updateField('safetySupport', e.target.value)} fullWidth multiline minRows={2}
          placeholder="馴染みの職員配置、安心グッズ" />
        <TextField label="事前支援" value={form.preSupport} onChange={e => updateField('preSupport', e.target.value)} fullWidth multiline minRows={2}
          placeholder="前日の確認、当日朝の予告" />
      </Stack>
    );
  }

  if (step === 5) {
    // §6 代替行動
    return (
      <Stack spacing={2}>
        <SectionTitle number={6} title="代替行動（Replacement Behavior）" desc="問題行動と同じ機能を果たす適切な行動を教える" />
        <TextField label="望ましい行動" value={form.desiredBehavior} onChange={e => updateField('desiredBehavior', e.target.value)} required fullWidth multiline minRows={2}
          placeholder="問題行動の代わりに取ってほしい行動" />
        <TextField label="教える方法" value={form.teachingMethod} onChange={e => updateField('teachingMethod', e.target.value)} fullWidth multiline minRows={2}
          placeholder="モデリング、プロンプト、ロールプレイ" />
        <TextField label="練習方法" value={form.practiceMethod} onChange={e => updateField('practiceMethod', e.target.value)} fullWidth multiline minRows={2}
          placeholder="練習頻度、場面設定、般化計画" />
        <TextField label="強化方法" value={form.reinforcementMethod} onChange={e => updateField('reinforcementMethod', e.target.value)} fullWidth multiline minRows={2}
          placeholder="即時強化、トークンエコノミー、二次強化" />
      </Stack>
    );
  }

  if (step === 6) {
    // §7 問題行動時の対応
    return (
      <Stack spacing={3}>
        <SectionTitle number={7} title="問題行動時対応" desc="行動が発生した瞬間に、チームで統一した動きをとるためのプロトコル" />
        
        <ResponseProtocolVisualizer phase="initial" />
        <TextField label="① 初動対応（前兆へのアプローチ）" value={form.initialResponse} onChange={e => updateField('initialResponse', e.target.value)} fullWidth multiline minRows={2}
          placeholder="例：穏やかに声をかける、特定の視覚提示を行う" />
        
        <ResponseProtocolVisualizer phase="escalated" />
        <TextField label="② 現場環境の調整（中期対応）" value={form.responseEnvironment} onChange={e => updateField('responseEnvironment', e.target.value)} fullWidth multiline minRows={2}
          placeholder="例：パーテーションを閉める、他利用者を誘導する" />
        <TextField label="③ 職員の動き・NG行動" value={form.staffResponse} onChange={e => updateField('staffResponse', e.target.value)} fullWidth multiline minRows={3}
          placeholder="迷わず動くための指示。やってはいけない（NG）行動も明記" />

        <Divider />
        <Typography variant="subtitle2" fontWeight={600}>安全確保と記録</Typography>
        <TextField label="安全確保（セーフガーディング）" value={form.safeguarding} onChange={e => updateField('safeguarding', e.target.value)} fullWidth multiline minRows={2}
          placeholder="距離の取り方、物品の撤去など" />
        <TextField label="記録・報告の方法" value={form.recordMethod} onChange={e => updateField('recordMethod', e.target.value)} fullWidth multiline minRows={2}
          placeholder="どのシートに、いつ記入するか" />
      </Stack>
    );
  }

  // §8 危機対応
  return (
    <Stack spacing={3}>
      <SectionTitle number={8} title="危機対応（エスカレーション）" desc="自傷・他害等の生命に関わる危機状況への限定的・緊急的対応" />

      <ResponseProtocolVisualizer phase="crisis" />
      
      <Alert severity="error" variant="outlined" sx={{ mb: 1, borderStyle: 'dashed' }}>
          ※危機対応は最終手段です。身体拘束等の権利侵害を未然に防ぐことを優先してください。
      </Alert>

      <TextField label="危機的行動の定義" value={form.dangerousBehavior} onChange={e => updateField('dangerousBehavior', e.target.value)} fullWidth multiline minRows={2}
        placeholder="「これが起きたら危機対応を開始する」という具体的な指標" />
      <TextField label="緊急時の具体的対応（3ステップ）" value={form.emergencyResponse} onChange={e => updateField('emergencyResponse', e.target.value)} fullWidth multiline minRows={3}
        placeholder="①〜③の順番で、迷わず行うべき緊急動作" />
      
      <Divider />
      <Typography variant="subtitle2" fontWeight={600}>連絡・連携プロトコル</Typography>
      <TextField label="医療連携（受診・主治医連絡）" value={form.medicalCoordination} onChange={e => updateField('medicalCoordination', e.target.value)} fullWidth multiline minRows={2} />
      <TextField label="家族への連絡（緊急連絡先・タイミング）" value={form.familyContact} onChange={e => updateField('familyContact', e.target.value)} fullWidth multiline minRows={2} />
      <TextField label="安全確保の具体的方法（ハード面）" value={form.safetyMethod} onChange={e => updateField('safetyMethod', e.target.value)} fullWidth multiline minRows={2} />
    </Stack>
  );
};
