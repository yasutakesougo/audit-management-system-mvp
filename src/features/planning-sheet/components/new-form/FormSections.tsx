/**
 * FormSections — 10セクションの描画コンポーネント
 *
 * renderSection(step) で各セクションの JSX を返す。
 * 親から form / updateField / renderProvenanceBadge を受け取る。
 */
import React from 'react';

// ── MUI ──
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ── Local ──
import type { FormState } from './types';
import { BEHAVIOR_FUNCTIONS, TRAINING_LEVELS } from './constants';

// ─────────────────────────────────────────────
// SectionTitle — 共通ヘッダー
// ─────────────────────────────────────────────

const SectionTitle: React.FC<{ number: number; title: string; desc?: string }> = ({ number, title, desc }) => (
  <Stack spacing={0.5} sx={{ mb: 1 }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip label={`§${number}`} size="small" color="primary" variant="outlined" />
      <Typography variant="h6" fontWeight={700}>{title}</Typography>
    </Stack>
    {desc && <Typography variant="body2" color="text.secondary">{desc}</Typography>}
  </Stack>
);

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface FormSectionsProps {
  step: number;
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  renderProvenanceBadge: (fieldKey: string) => React.ReactNode;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const FormSections: React.FC<FormSectionsProps> = ({ step, form, updateField, renderProvenanceBadge }) => {
  switch (step) {
    case 0: // §1 基本情報
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
    case 1: // §2 対象行動
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
    case 2: // §3 氷山分析
      return (
        <Stack spacing={2}>
          <SectionTitle number={3} title="行動の背景（氷山分析）" desc="行動の水面下にある要因を構造化して分析する" />
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
              {'　　　🏔️ 問題行動（水面上）\n━━━━━━━━━━━━━━━━━━\n　  💭 感情・心理\n──────────────────\n　  🧠 認知・理解\n──────────────────\n　  🏠 環境要因\n──────────────────\n　  💡 本人のニーズ（水面下）'}
            </Typography>
          </Paper>
          <Stack spacing={0.5}>
            {renderProvenanceBadge('triggers')}
            <TextField label="トリガー（きっかけ）" value={form.triggers} onChange={e => updateField('triggers', e.target.value)} required fullWidth multiline minRows={2}
              placeholder="行動を引き起こす直接的なきっかけ" />
          </Stack>
          <Stack spacing={0.5}>
            {renderProvenanceBadge('environmentFactors')}
            <TextField label="環境要因" value={form.environmentFactors} onChange={e => updateField('environmentFactors', e.target.value)} fullWidth multiline minRows={2}
              placeholder="物理的環境・人的環境・時間帯" />
          </Stack>
          <Stack spacing={0.5}>
            {renderProvenanceBadge('emotions')}
            <TextField label="本人の感情" value={form.emotions} onChange={e => updateField('emotions', e.target.value)} fullWidth multiline minRows={2}
              placeholder="不安、混乱、怒り、恐怖など" />
          </Stack>
          <Stack spacing={0.5}>
            {renderProvenanceBadge('cognition')}
            <TextField label="理解状況（認知）" value={form.cognition} onChange={e => updateField('cognition', e.target.value)} fullWidth multiline minRows={2}
              placeholder="言語理解力、見通しの持ちやすさ" />
          </Stack>
          <Stack spacing={0.5}>
            {renderProvenanceBadge('needs')}
            <TextField label="本人ニーズ" value={form.needs} onChange={e => updateField('needs', e.target.value)} required fullWidth multiline minRows={2}
              placeholder="「本当はこうしたい」「こうなりたい」" />
          </Stack>
        </Stack>
      );
    case 3: // §4 FBA
      return (
        <Stack spacing={2}>
          <SectionTitle number={4} title="行動機能分析（FBA）" desc="行動の「機能（目的）」を特定し、ABC記録で裏付ける" />
          <Typography variant="subtitle2" fontWeight={600}>行動の機能（複数選択可）</Typography>
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
    case 4: // §5 予防的支援
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
    case 5: // §6 代替行動
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
    case 6: // §7 問題行動時の対応
      return (
        <Stack spacing={2}>
          <SectionTitle number={7} title="問題行動時の対応" desc="行動が発生した場合の対応手順を明確にする" />
          <TextField label="初期対応" value={form.initialResponse} onChange={e => updateField('initialResponse', e.target.value)} required fullWidth multiline minRows={2}
            placeholder="最初の声かけ・対応方法" />
          <TextField label="環境調整" value={form.responseEnvironment} onChange={e => updateField('responseEnvironment', e.target.value)} fullWidth multiline minRows={2}
            placeholder="その場の環境をどう変えるか" />
          <TextField label="安全確保" value={form.safeguarding} onChange={e => updateField('safeguarding', e.target.value)} fullWidth multiline minRows={2}
            placeholder="本人・他者の安全をどう守るか" />
          <TextField label="職員対応" value={form.staffResponse} onChange={e => updateField('staffResponse', e.target.value)} fullWidth multiline minRows={2}
            placeholder="職員の立ち位置、人数、コミュニケーション" />
          <TextField label="記録方法" value={form.recordMethod} onChange={e => updateField('recordMethod', e.target.value)} fullWidth multiline minRows={2}
            placeholder="いつ・何を・どのように記録するか" />
        </Stack>
      );
    case 7: // §8 危機対応
      return (
        <Stack spacing={2}>
          <SectionTitle number={8} title="危機対応（リスク管理）" desc="危険行動発生時のエスカレーション手順" />
          <Alert severity="warning" variant="outlined" sx={{ mb: 1 }}>
            ⚠️ 身体拘束の判断基準と手続きを明確に定めてください（虐待防止法準拠）
          </Alert>
          <TextField label="危険行動" value={form.dangerousBehavior} onChange={e => updateField('dangerousBehavior', e.target.value)} fullWidth multiline minRows={2}
            placeholder="最も危険性の高い行動" />
          <TextField label="緊急対応" value={form.emergencyResponse} onChange={e => updateField('emergencyResponse', e.target.value)} required fullWidth multiline minRows={2}
            placeholder="段階的なエスカレーション手順" />
          <TextField label="医療連携" value={form.medicalCoordination} onChange={e => updateField('medicalCoordination', e.target.value)} fullWidth multiline minRows={2}
            placeholder="主治医連絡先、定期受診、服薬情報" />
          <TextField label="家族連絡" value={form.familyContact} onChange={e => updateField('familyContact', e.target.value)} fullWidth multiline minRows={2}
            placeholder="連絡基準、連絡先、報告方法" />
          <TextField label="安全確保方法" value={form.safetyMethod} onChange={e => updateField('safetyMethod', e.target.value)} fullWidth multiline minRows={2}
            placeholder="物理的安全対策（クッション材、コーナーガード等）" />
          <FormControlLabel
            control={<Checkbox checked={form.hasMedicalCoordination} onChange={e => updateField('hasMedicalCoordination', e.target.checked)} />}
            label="医療機関との連携あり"
          />
        </Stack>
      );
    case 8: // §9 モニタリング
      return (
        <Stack spacing={2}>
          <SectionTitle number={9} title="モニタリング" desc="支援の効果を定量的・定性的に評価する" />
          <TextField label="評価指標" value={form.evaluationIndicator} onChange={e => updateField('evaluationIndicator', e.target.value)} required fullWidth multiline minRows={2}
            placeholder="何を指標とするか（頻度、持続時間、代替行動の使用率など）" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="評価期間" value={form.evaluationPeriod} onChange={e => updateField('evaluationPeriod', e.target.value)} fullWidth
              placeholder="例: 毎月末に月次評価" />
            <TextField type="number" label="モニタリング周期（日）" value={form.monitoringCycleDays} onChange={e => updateField('monitoringCycleDays', Number(e.target.value) || 90)} fullWidth
              inputProps={{ min: 1, max: 365 }} />
          </Stack>
          <TextField label="評価方法" value={form.evaluationMethod} onChange={e => updateField('evaluationMethod', e.target.value)} fullWidth multiline minRows={2}
            placeholder="ABC記録集計、グラフ化、カンファレンス" />
          <TextField label="改善結果" value={form.improvementResult} onChange={e => updateField('improvementResult', e.target.value)} fullWidth multiline minRows={2}
            placeholder="（評価後に記入）前回からの変化" />
          <TextField label="次の支援方針" value={form.nextSupport} onChange={e => updateField('nextSupport', e.target.value)} fullWidth multiline minRows={2}
            placeholder="（評価後に記入）次の改善アクション" />
        </Stack>
      );
    case 9: // §10 チーム共有
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
    default:
      return null;
  }
};

export default FormSections;
