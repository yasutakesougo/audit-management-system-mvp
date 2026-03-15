/**
 * NewPlanningSheetForm — 強度行動障害支援計画シート新規作成フォーム
 *
 * `/support-planning-sheet/new` で表示される。
 *
 * 構成（完全版テンプレート 10セクション）：
 *   §1 基本情報
 *   §2 対象行動（ターゲット行動）
 *   §3 行動の背景（氷山分析）
 *   §4 行動機能分析（FBA）
 *   §5 予防的支援
 *   §6 代替行動（Replacement Behavior）
 *   §7 問題行動時の対応
 *   §8 危機対応（リスク管理）
 *   §9 モニタリング
 *   §10 チーム共有
 *
 * @see https://github.com/yasutakesougo/audit-management-system-mvp
 * @see src/domain/isp/schema.ts — ドメインスキーマ
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

// ── MUI ──
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ── Icons ──
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';

// ── Domain ──
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { useAuth } from '@/auth/useAuth';
import type { PlanningSheetRepository, IspRepository } from '@/domain/isp/port';
import type { PlanningSheetFormValues } from '@/domain/isp/schema';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface NewPlanningSheetFormProps {
  planningSheetRepo: PlanningSheetRepository;
  ispRepo: IspRepository;
}

interface UserOption {
  id: string;
  label: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SECTION_STEPS = [
  '基本情報',
  '対象行動',
  '氷山分析',
  'FBA',
  '予防的支援',
  '代替行動',
  '問題行動時対応',
  '危機対応',
  'モニタリング',
  'チーム共有',
] as const;

const BEHAVIOR_FUNCTIONS = [
  { value: 'avoidance', label: '回避 / 逃避' },
  { value: 'attention', label: '注目獲得' },
  { value: 'sensory', label: '感覚刺激' },
  { value: 'demand', label: '要求 / 伝達' },
] as const;

const TRAINING_LEVELS = [
  { value: '基礎研修', label: '基礎研修修了' },
  { value: '実践研修', label: '実践研修修了' },
  { value: '中核人材研修', label: '中核人材研修修了' },
  { value: 'なし', label: '研修未修了' },
] as const;

// ─────────────────────────────────────────────
// Form state type
// ─────────────────────────────────────────────

interface FormState {
  // §1 基本情報
  title: string;
  supportLevel: string;
  behaviorScore: string;
  planPeriod: string;
  trainingLevel: string;
  relatedOrganizations: string;
  // §2 対象行動
  targetBehavior: string;
  behaviorFrequency: string;
  behaviorSituation: string;
  behaviorDuration: string;
  behaviorIntensity: string;
  behaviorRisk: string;
  behaviorImpact: string;
  // §3 氷山分析
  triggers: string;
  environmentFactors: string;
  emotions: string;
  cognition: string;
  needs: string;
  // §4 FBA
  behaviorFunctions: string[];
  behaviorFunctionDetail: string;
  abcAntecedent: string;
  abcBehavior: string;
  abcConsequence: string;
  // §5 予防的支援
  environmentalAdjustment: string;
  visualSupport: string;
  communicationSupport: string;
  safetySupport: string;
  preSupport: string;
  // §6 代替行動
  desiredBehavior: string;
  teachingMethod: string;
  practiceMethod: string;
  reinforcementMethod: string;
  // §7 問題行動時対応
  initialResponse: string;
  responseEnvironment: string;
  safeguarding: string;
  staffResponse: string;
  recordMethod: string;
  // §8 危機対応
  dangerousBehavior: string;
  emergencyResponse: string;
  medicalCoordination: string;
  familyContact: string;
  safetyMethod: string;
  hasMedicalCoordination: boolean;
  // §9 モニタリング
  evaluationIndicator: string;
  evaluationPeriod: string;
  evaluationMethod: string;
  improvementResult: string;
  nextSupport: string;
  monitoringCycleDays: number;
  // §10 チーム共有
  sharingMethod: string;
  training: string;
  personInCharge: string;
  confirmationDate: string;
  teamConsensusNote: string;
}

const INITIAL_FORM: FormState = {
  title: '', supportLevel: '', behaviorScore: '', planPeriod: '',
  trainingLevel: 'なし', relatedOrganizations: '',
  targetBehavior: '', behaviorFrequency: '', behaviorSituation: '',
  behaviorDuration: '', behaviorIntensity: '', behaviorRisk: '', behaviorImpact: '',
  triggers: '', environmentFactors: '', emotions: '', cognition: '', needs: '',
  behaviorFunctions: [], behaviorFunctionDetail: '',
  abcAntecedent: '', abcBehavior: '', abcConsequence: '',
  environmentalAdjustment: '', visualSupport: '', communicationSupport: '',
  safetySupport: '', preSupport: '',
  desiredBehavior: '', teachingMethod: '', practiceMethod: '', reinforcementMethod: '',
  initialResponse: '', responseEnvironment: '', safeguarding: '',
  staffResponse: '', recordMethod: '',
  dangerousBehavior: '', emergencyResponse: '', medicalCoordination: '',
  familyContact: '', safetyMethod: '', hasMedicalCoordination: false,
  evaluationIndicator: '', evaluationPeriod: '', evaluationMethod: '',
  improvementResult: '', nextSupport: '', monitoringCycleDays: 90,
  sharingMethod: '', training: '', personInCharge: '', confirmationDate: '', teamConsensusNote: '',
};

// ─────────────────────────────────────────────
// Sample data (for demo)
// ─────────────────────────────────────────────

const SAMPLE_FORM: FormState = {
  // §1
  title: '外出活動場面における行動支援計画',
  supportLevel: '区分5',
  behaviorScore: '18点',
  planPeriod: '2026年4月1日 〜 2026年9月30日',
  trainingLevel: '実践研修',
  relatedOrganizations: '相談支援センターみらい、訪問看護ステーションあおば',
  // §2
  targetBehavior: '外出活動前に予定が理解できないと大声で拒否し床に座り込む',
  behaviorFrequency: '週3〜4回（主に月曜・金曜の午前中に多い）',
  behaviorSituation: '外出活動の準備開始時（9:30頃）、活動内容の変更時',
  behaviorDuration: '5〜20分（声掛けなしで30分以上に及ぶこともある）',
  behaviorIntensity: '大声（70dB程度）、床への座り込み、周辺の物を払いのける',
  behaviorRisk: '本人：膝や肘の打撲リスク / 他者：払いのけ動作による接触リスク',
  behaviorImpact: '他利用者への心理的影響、活動スケジュールの遅延、職員の対応負荷増大',
  // §3
  triggers: '予定の急な変更、見通しが持てない状況、言語指示のみでの予定説明',
  environmentFactors: '騒がしい環境、複数の利用者が同時に準備する場面、初めての外出先',
  emotions: '不安、混乱、見通しが立たないことへの恐怖感',
  cognition: '言語理解は2語文程度。視覚情報の方が理解しやすい。時系列の概念が弱い',
  needs: '「何が起こるか知りたい」「安心できる情報が欲しい」「自分のペースで準備したい」',
  // §4
  behaviorFunctions: ['avoidance', 'demand'],
  behaviorFunctionDetail: '予定が分からないことによる不安の回避が主な機能。同時に「知りたい」「教えて」という要求・伝達の機能も含む。不安が高まると回避行動が優位になり、要求表出が困難になる悪循環が観察される。',
  abcAntecedent: '職員が「今日は〇〇に行きます」と口頭で伝える → 本人は視線を合わせず不安な表情',
  abcBehavior: '「いやだ！」と大声 → 床に座り込む → 周囲の物を払いのける',
  abcConsequence: '職員が対応に追われる → 外出が延期 or 中止 → 本人は静かになる（回避成功）',
  // §5
  environmentalAdjustment: '外出準備エリアを個別化（パーテーションで区切り、他利用者の動きが見えにくくする）。準備開始の5分前に個別に予告する。',
  visualSupport: '①外出先の写真カード ②活動の流れを3ステップで示すスケジュールボード ③「いつ帰るか」を時計の写真で提示',
  communicationSupport: '「いやだ」「あとで」「教えて」の3種のコミュニケーションカードを手元に配置。カードの使い方を毎朝1回練習する。',
  safetySupport: '馴染みの職員が外出時に同行する。初回の外出先は事前に写真・動画で紹介する。',
  preSupport: '前日の夕方に翌日のスケジュールを写真カードで確認する時間を設ける。当日朝の会で再度確認。',
  // §6
  desiredBehavior: '不安を感じたらコミュニケーションカード（「教えて」カード）を職員に見せる',
  teachingMethod: '落ち着いている場面でロールプレイ形式で練習。「こういう時はこのカードを出してね」と具体的に見本を示す。',
  practiceMethod: '毎朝の朝の会で1回、カード使用の練習。成功体験を毎日1回以上設定する。安定してきたら実場面での般化を目指す。',
  reinforcementMethod: 'カードを使えた場合は即時に「教えてくれてありがとう、〇〇に行くよ（写真）」と具体的に応答。好きな活動を5分追加する二次強化も併用。',
  // §7
  initialResponse: '大声が出たら穏やかに「写真見る？」と声掛け + 写真カードを手の届く位置に差し出す。叱責や制止はしない。',
  responseEnvironment: '座り込んだ場所の周辺にクッションを配置。他利用者は別室に誘導し、騒音・刺激を低減。',
  safeguarding: '払いのけ動作が見られたら1m以上の距離を保つ。硬い物品を事前に撤去。',
  staffResponse: '対応は原則1名。2名以上で囲まない。低い姿勢で横に位置し、正面からの接近は避ける。',
  recordMethod: '行動直後に「ABC簡易記録シート」に記入。頻度・持続時間・トリガーを定量記録。',
  // §8
  dangerousBehavior: '頭部を壁に打ち付ける行動が月1回程度発生（過去6ヶ月で3回）。',
  emergencyResponse: '①壁と頭の間にクッションを挿入 ②他利用者を退避 ③5分経過で主任に連絡 ④打撲確認後、医務室で観察（最低30分）',
  medicalCoordination: '月1回の精神科定期受診時にー行動記録サマリーを主治医に共有。投薬調整の相談　連絡先: △△クリニック 045-XXX-XXXX',
  familyContact: '危険行動発生時は当日中に家族に電話連絡。月次の支援報告書にも記載。緊急連絡先：母 090-XXXX-XXXX',
  safetyMethod: '壁面にクッション材を貼付。活動エリアの角にコーナーガードを設置。ヘルメットの使用は本人の拒否が強いため現時点では不使用。',
  hasMedicalCoordination: true,
  // §9
  evaluationIndicator: '①外出前の拒否行動（大声・座り込み）の頻度 ②カード使用回数 ③カード使用後のスムーズな移行率',
  evaluationPeriod: '毎月末に月次評価。3ヶ月ごとに総合評価（次回: 2026年6月30日）',
  evaluationMethod: 'ABC記録シートの集計（頻度・持続時間の推移グラフ化）。職員間カンファレンスでの質的評価。本人の表情・参加度の主観評価。',
  improvementResult: '',
  nextSupport: '',
  monitoringCycleDays: 90,
  // §10
  sharingMethod: '①朝礼での当日の留意点共有 ②週1回の支援会議で進捗報告 ③支援計画シートを休憩室に掲示（個人情報はコード化）',
  training: '新任職員向けOJT（ベテラン職員がモデリング）。月1回の事例検討会で本ケースを共有。',
  personInCharge: '主担当: 山田太郎（実践研修修了）/ 副担当: 佐藤花子（基礎研修修了）',
  confirmationDate: '2026年4月1日（計画開始時）',
  teamConsensusNote: '外出先での行動は改善傾向にあるが、初めての場所への不安は依然強い。写真事前提示の効果は高く、今後もビジュアルサポートを充実させる方針。',
};

// ─────────────────────────────────────────────
// Default PlanningSheetFormValues builder
// ─────────────────────────────────────────────

function buildCreateInput(
  form: FormState,
  userId: string,
  ispId: string,
  createdBy: string,
): PlanningSheetFormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    userId,
    ispId,
    title: form.title,
    targetScene: form.behaviorSituation,
    targetDomain: '強度行動障害支援',
    observationFacts: [
      `【対象行動】${form.targetBehavior}`,
      `【発生頻度】${form.behaviorFrequency}`,
      `【発生場面】${form.behaviorSituation}`,
      `【継続時間】${form.behaviorDuration}`,
      `【強度】${form.behaviorIntensity}`,
      `【危険性】${form.behaviorRisk}`,
      `【影響】${form.behaviorImpact}`,
    ].filter(l => !l.endsWith('】')).join('\n'),
    collectedInformation: [
      `【トリガー】${form.triggers}`,
      `【環境要因】${form.environmentFactors}`,
      `【本人の感情】${form.emotions}`,
      `【理解状況】${form.cognition}`,
      `【本人ニーズ】${form.needs}`,
    ].filter(l => !l.endsWith('】')).join('\n'),
    interpretationHypothesis: [
      `【機能分析】${form.behaviorFunctionDetail}`,
      `【ABC: 先行事象】${form.abcAntecedent}`,
      `【ABC: 行動】${form.abcBehavior}`,
      `【ABC: 結果】${form.abcConsequence}`,
    ].filter(l => !l.endsWith('】')).join('\n'),
    supportIssues: form.evaluationIndicator,
    supportPolicy: [
      `【予防的支援】`,
      `環境調整: ${form.environmentalAdjustment}`,
      `見通し支援: ${form.visualSupport}`,
      `コミュニケーション支援: ${form.communicationSupport}`,
      `安心支援: ${form.safetySupport}`,
      `事前支援: ${form.preSupport}`,
    ].join('\n'),
    environmentalAdjustments: form.environmentalAdjustment,
    concreteApproaches: [
      `【代替行動】`,
      `望ましい行動: ${form.desiredBehavior}`,
      `教える方法: ${form.teachingMethod}`,
      `練習方法: ${form.practiceMethod}`,
      `強化方法: ${form.reinforcementMethod}`,
      ``,
      `【問題行動時の対応】`,
      `初期対応: ${form.initialResponse}`,
      `環境調整: ${form.responseEnvironment}`,
      `安全確保: ${form.safeguarding}`,
      `職員対応: ${form.staffResponse}`,
      `記録方法: ${form.recordMethod}`,
    ].join('\n'),
    appliedFrom: today,
    nextReviewAt: undefined,
    authoredByStaffId: createdBy,
    authoredByQualification: 'unknown',
    authoredAt: today,
    applicableServiceType: 'other',
    applicableAddOnTypes: ['severe_disability_support'],
    deliveredToUserAt: undefined,
    reviewedAt: undefined,
    hasMedicalCoordination: form.hasMedicalCoordination,
    hasEducationCoordination: false,
    supportStartDate: today,
    monitoringCycleDays: form.monitoringCycleDays,
    status: 'draft',
  };
}

// ─────────────────────────────────────────────
// Section Components
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
// Component
// ─────────────────────────────────────────────

export const NewPlanningSheetForm: React.FC<NewPlanningSheetFormProps> = ({
  planningSheetRepo,
  ispRepo,
}) => {
  const navigate = useNavigate();
  const { data: users } = useUsersDemo();
  const { account } = useAuth();

  // ── User selection state ──
  const [selectedUser, setSelectedUser] = React.useState<UserOption | null>(null);
  const [ispId, setIspId] = React.useState<string | null>(null);
  const [ispLoading, setIspLoading] = React.useState(false);
  const [ispWarning, setIspWarning] = React.useState<string | null>(null);

  // ── Form state ──
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [activeStep, setActiveStep] = React.useState(0);

  // ── Save state ──
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // ── Helpers ──
  const userOptions = React.useMemo<UserOption[]>(
    () => users.map(u => ({ id: u.UserID, label: `${u.FullName} (${u.UserID})` })),
    [users],
  );

  const updateField = React.useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── User selection handler ──
  const handleUserSelect = React.useCallback(
    async (_event: React.SyntheticEvent, value: UserOption | null) => {
      setSelectedUser(value);
      setIspId(null);
      setIspWarning(null);
      setSaveError(null);
      if (!value) return;

      setIspLoading(true);
      try {
        const currentIsp = await ispRepo.getCurrentByUser(value.id);
        if (currentIsp) {
          setIspId(currentIsp.id);
        } else {
          setIspId(`draft-isp-${value.id}-${Date.now()}`);
          setIspWarning(`利用者「${value.label}」の現行 ISP が見つかりません。仮の紐付けで続行します。`);
        }
      } catch {
        setIspId(`draft-isp-${value.id}-${Date.now()}`);
        setIspWarning('ISP の取得に失敗しました。仮の紐付けで続行します。');
      } finally {
        setIspLoading(false);
      }
    },
    [ispRepo],
  );

  // ── Fill sample data ──
  const handleFillSample = React.useCallback(() => setForm(SAMPLE_FORM), []);

  // ── Save ──
  const handleCreate = React.useCallback(async () => {
    if (!selectedUser || !ispId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const createdBy = (account as { name?: string })?.name ?? '不明';
      const input = buildCreateInput(form, selectedUser.id, ispId, createdBy);
      const created = await planningSheetRepo.create(input);
      navigate(`/support-planning-sheet/${created.id}`, { replace: true });
    } catch (err) {
      setSaveError(`作成に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [selectedUser, ispId, account, form, planningSheetRepo, navigate]);

  // ── Navigation ──
  const canProceedToForm = !!(selectedUser && ispId);

  // ── Section renders ──
  const renderSection = (step: number) => {
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
            <TextField label="トリガー（きっかけ）" value={form.triggers} onChange={e => updateField('triggers', e.target.value)} required fullWidth multiline minRows={2}
              placeholder="行動を引き起こす直接的なきっかけ" />
            <TextField label="環境要因" value={form.environmentFactors} onChange={e => updateField('environmentFactors', e.target.value)} fullWidth multiline minRows={2}
              placeholder="物理的環境・人的環境・時間帯" />
            <TextField label="本人の感情" value={form.emotions} onChange={e => updateField('emotions', e.target.value)} fullWidth multiline minRows={2}
              placeholder="不安、混乱、怒り、恐怖など" />
            <TextField label="理解状況（認知）" value={form.cognition} onChange={e => updateField('cognition', e.target.value)} fullWidth multiline minRows={2}
              placeholder="言語理解力、見通しの持ちやすさ" />
            <TextField label="本人ニーズ" value={form.needs} onChange={e => updateField('needs', e.target.value)} required fullWidth multiline minRows={2}
              placeholder="「本当はこうしたい」「こうなりたい」" />
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

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: 4, maxWidth: 960, mx: 'auto' }}>
      <Stack spacing={3}>
        {/* ── ヘッダー ── */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DescriptionRoundedIcon color="primary" />
              <Typography variant="h5" fontWeight={700}>
                強度行動障害支援計画シート
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" color="secondary" startIcon={<AutoFixHighRoundedIcon />} onClick={handleFillSample} disabled={!canProceedToForm}>
                サンプルデータ
              </Button>
              <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/support-plan-guide')}>
                ISP 画面に戻る
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* ── 利用者選択 ── */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PersonSearchRoundedIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>利用者の選択</Typography>
            </Stack>
            <Autocomplete
              options={userOptions}
              value={selectedUser}
              onChange={handleUserSelect}
              getOptionLabel={o => o.label}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={params => (
                <TextField {...params} label="利用者を検索" placeholder="名前または ID で検索..."
                  InputProps={{ ...params.InputProps, endAdornment: (<>{ispLoading ? <CircularProgress size={20} /> : null}{params.InputProps.endAdornment}</>) }} />
              )}
              noOptionsText="該当する利用者が見つかりません"
            />
            {ispWarning && <Alert severity="warning" variant="outlined">{ispWarning}</Alert>}
            {ispId && !ispWarning && <Alert severity="success" variant="outlined">現行 ISP と紐付けます（ISP ID: {ispId}）</Alert>}
          </Stack>
        </Paper>

        {/* ── Stepper + Form ── */}
        {canProceedToForm && (
          <>
            <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 }, overflowX: 'auto' }}>
              <Stepper activeStep={activeStep} alternativeLabel sx={{ minWidth: 800 }}>
                {SECTION_STEPS.map((label, index) => (
                  <Step key={label} completed={index < activeStep}>
                    <StepLabel
                      sx={{ cursor: 'pointer', '& .MuiStepLabel-label': { fontSize: '0.75rem' } }}
                      onClick={() => setActiveStep(index)}
                    >
                      {label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              {renderSection(activeStep)}
            </Paper>

            {/* ── Navigation ── */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button
                startIcon={<NavigateBeforeRoundedIcon />}
                onClick={() => setActiveStep(s => Math.max(0, s - 1))}
                disabled={activeStep === 0}
              >
                前へ
              </Button>

              <Typography variant="body2" color="text.secondary">
                {activeStep + 1} / {SECTION_STEPS.length}
              </Typography>

              {activeStep < SECTION_STEPS.length - 1 ? (
                <Button
                  variant="contained"
                  endIcon={<NavigateNextRoundedIcon />}
                  onClick={() => setActiveStep(s => Math.min(SECTION_STEPS.length - 1, s + 1))}
                >
                  次へ
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <AddRoundedIcon />}
                  onClick={handleCreate}
                  disabled={!form.title.trim() || isSaving}
                >
                  {isSaving ? '作成中…' : '支援計画シートを作成'}
                </Button>
              )}
            </Stack>

            {saveError && <Alert severity="error" variant="outlined">{saveError}</Alert>}
          </>
        )}
      </Stack>
    </Box>
  );
};
