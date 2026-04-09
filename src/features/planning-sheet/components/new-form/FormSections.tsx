/**
 * FormSections — 10セクションの描画コンポーネント
 *
 * renderSection(step) で各セクションの JSX を返す。
 * 親から form / updateField / renderProvenanceBadge を受け取る。
 */
import React from 'react';

// ── MUI ──
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
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
import { BEHAVIOR_FUNCTIONS, TRAINING_LEVELS, ICEBERG_FACTORS } from './constants';

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
// IcebergIllustration — 氷山分析の視覚図
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// IcebergIllustration — 氷山分析の視覚図
// ─────────────────────────────────────────────

const IcebergIllustration: React.FC<{ surfaceValue?: string }> = ({ surfaceValue }) => (
  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: 6 }}>
    <Box sx={{
      width: '100%',
      maxWidth: 600,
      bgcolor: '#f8fbff',
      borderRadius: 4,
      p: { xs: 2, sm: 4 },
      pb: { xs: 3, sm: 5 },
      border: '1px solid #e0f2fe',
      boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <svg
        viewBox="0 0 520 400"
        width="100%"
        height="auto"
        role="img"
        aria-label="氷山分析の構造図"
        style={{ display: 'block', maxWidth: '520px' }}
      >
        {/* タイトル (SVG内でも中央) */}
        <text x="260" y="30" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0c4a6e">氷山分析</text>

        {/* 水面上：問題行動 (入力値があれば表示) */}
        <rect x="100" y="50" width="320" height="56" rx="16" fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />
        <text x="260" y="86" textAnchor="middle" fontSize={surfaceValue && surfaceValue.length > 15 ? 14 : 18} fontWeight="700" fill="#78350f">
          {surfaceValue 
            ? (surfaceValue.length > 22 ? surfaceValue.substring(0, 20) + '...' : surfaceValue)
            : '🏔️ 問題行動（水面上）'
          }
        </text>

        {/* 水面ライン */}
        <line x1="30" y1="130" x2="490" y2="130" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        <text x="490" y="122" textAnchor="end" fontSize="12" fontWeight="700" fill="#0369a1">水面</text>

        {/* 氷山本体 (幅を広げて中央感を強調) */}
        <path d="M120 150 L400 150 L460 380 L60 380 Z" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />

        {/* 層区切り */}
        <line x1="105" y1="195" x2="415" y2="195" stroke="#bfdbfe" strokeWidth="1.5" />
        <line x1="90" y1="240" x2="430" y2="240" stroke="#bfdbfe" strokeWidth="1.5" />
        <line x1="75" y1="285" x2="445" y2="285" stroke="#bfdbfe" strokeWidth="1.5" />
        <line x1="65" y1="330" x2="455" y2="330" stroke="#bfdbfe" strokeWidth="1.5" />

        {/* ラベル — 260を軸に完全中央配置 */}
        <text x="260" y="180" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">{ICEBERG_FACTORS[1].icon} {ICEBERG_FACTORS[1].label}</text>
        <text x="260" y="225" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">{ICEBERG_FACTORS[2].icon} {ICEBERG_FACTORS[2].label}</text>
        <text x="260" y="270" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">{ICEBERG_FACTORS[3].icon} {ICEBERG_FACTORS[3].label}</text>
        <text x="260" y="315" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1e40af">{ICEBERG_FACTORS[4].icon} {ICEBERG_FACTORS[4].label}</text>
        <text x="260" y="362" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1d4ed8">{ICEBERG_FACTORS[5].icon} {ICEBERG_FACTORS[5].label}</text>
      </svg>
      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary', fontStyle: 'italic', px: 2 }}>
        表面に見える行動の下に、背景要因や本人の願いが重なっています。
      </Typography>
    </Box>
  </Box>
);

// ─────────────────────────────────────────────
// ABCIllustration — ABC分析の視覚図
// ─────────────────────────────────────────────

const ABCIllustration: React.FC<{ a?: string; b?: string; c?: string }> = ({ a, b, c }) => (
  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: 4 }}>
    <Box sx={{
      width: '100%',
      maxWidth: 700,
      bgcolor: '#fff',
      borderRadius: 4,
      p: { xs: 2, sm: 3 },
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
        {/* A: Antecedent */}
        <Box sx={{ flex: 1, minHeight: 120, p: 2, borderRadius: 3, border: '2px solid #93c5fd', bgcolor: '#f0f9ff', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={800} color="primary.main" gutterBottom sx={{ fontSize: '0.65rem', borderBottom: '1px solid currentColor', mb: 1, px: 1 }}>A: 先行事象</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#1e3a8a', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {a || '（行動の直前の状況）'}
          </Typography>
        </Box>

        <Box sx={{ color: '#cbd5e1', fontWeight: 900 }}>▶</Box>

        {/* B: Behavior */}
        <Box sx={{ flex: 1, minHeight: 120, p: 2, borderRadius: 3, border: '2px solid #fecaca', bgcolor: '#fef2f2', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={800} color="error.main" gutterBottom sx={{ fontSize: '0.65rem', borderBottom: '1px solid currentColor', mb: 1, px: 1 }}>B: 行動</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#7f1d1d', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {b || '（具体的な行動の内容）'}
          </Typography>
        </Box>

        <Box sx={{ color: '#cbd5e1', fontWeight: 900 }}>▶</Box>

        {/* C: Consequence */}
        <Box sx={{ flex: 1, minHeight: 120, p: 2, borderRadius: 3, border: '2px solid #bbf7d0', bgcolor: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={800} color="success.main" gutterBottom sx={{ fontSize: '0.65rem', borderBottom: '1px solid currentColor', mb: 1, px: 1 }}>C: 結果</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#064e3b', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {c || '（行動のあとの変化）'}
          </Typography>
        </Box>
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', mt: 2, textAlign: 'center', color: 'text.secondary', fontWeight: 500 }}>
        この連鎖（A→B→C）から、なぜその行動が繰り返されるのか（機能）を推測します。
      </Typography>
    </Box>
  </Box>
);

// ─────────────────────────────────────────────
// ResponseProtocolVisualizer — 現場対応プロトコル（Cフェーズ）
// ─────────────────────────────────────────────

const ResponseProtocolVisualizer: React.FC<{ phase: 'initial' | 'escalated' | 'crisis' }> = ({ phase }) => {
  const config = {
    initial: { label: '🟢 初期対応（前兆期）', color: '#10b981', bg: '#ecfdf5', dark: '#064e3b', desc: '落ち着きがなくなる、声が出る等' },
    escalated: { label: '🟡 中期対応（行動発現期）', color: '#f59e0b', bg: '#fffbeb', dark: '#78350f', desc: '大声、座り込み、物への接触等' },
    crisis: { label: '🔴 危機対応（極期）', color: '#ef4444', bg: '#fef2f2', dark: '#7f1d1d', desc: '自傷、他害、激しい破壊等' },
  }[phase];

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Paper variant="outlined" sx={{ p: 2, borderLeft: `6px solid ${config.color}`, bgcolor: config.bg, borderRadius: '8px 16px 16px 8px' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ 
            width: 48, height: 48, borderRadius: '50%', bgcolor: config.color, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' 
          }}>
            {phase === 'initial' && '🟢'}
            {phase === 'escalated' && '🟡'}
            {phase === 'crisis' && '🔴'}
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} color={config.dark}>{config.label}</Typography>
            <Typography variant="caption" color={config.dark} sx={{ opacity: 0.8 }}>{config.desc}</Typography>
          </Box>
        </Stack>
      </Paper>
      
      {/* 迷わないための指示構造 */}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Box sx={{ flex: 1, p: 1, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">判断せずに動く</Typography>
        </Box>
        <Box sx={{ flex: 1, p: 1, bgcolor: '#fef2f2', borderRadius: 2, border: '1px dashed #fecaca', textAlign: 'center' }}>
          <Typography variant="caption" fontWeight={700} color="error.main">NG行動の徹底回避</Typography>
        </Box>
      </Stack>
    </Box>
  );
};

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
    case 3: // §4 FBA
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
    case 7: // §8 危機対応
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
