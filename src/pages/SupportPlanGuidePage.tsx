import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import React from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUsersStore } from '@/features/users/store';
import type { IUserMaster } from '@/features/users/types';

type SupportPlanForm = {
  serviceUserName: string;
  supportLevel: string;
  planPeriod: string;
  assessmentSummary: string;
  strengths: string;
  longTermGoal: string;
  shortTermGoals: string;
  dailySupports: string;
  creativeActivities: string;
  decisionSupport: string;
  conferenceNotes: string;
  monitoringPlan: string;
  reviewTiming: string;
  riskManagement: string;
  complianceControls: string;
  improvementIdeas: string;
};

const defaultFormState: SupportPlanForm = {
  serviceUserName: '',
  supportLevel: '',
  planPeriod: '',
  assessmentSummary: '',
  strengths: '',
  longTermGoal: '',
  shortTermGoals: '',
  dailySupports: '',
  creativeActivities: '',
  decisionSupport: '',
  conferenceNotes: '',
  monitoringPlan: '',
  reviewTiming: '',
  riskManagement: '',
  complianceControls: '',
  improvementIdeas: '',
};

type SectionKey =
  | 'overview'
  | 'assessment'
  | 'smart'
  | 'supports'
  | 'decision'
  | 'monitoring'
  | 'risk'
  | 'excellence'
  | 'preview';

type FieldConfig = {
  key: keyof SupportPlanForm;
  label: string;
  helper?: string;
  placeholder?: string;
  minRows?: number;
  quickPhrases?: string[];
  required?: boolean;
};

type SectionConfig = {
  key: SectionKey;
  label: string;
  description: string;
  fields: FieldConfig[];
};

type ToastState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' };

type SupportPlanDraft = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: SupportPlanForm;
  userId?: number | string | null;
  userCode?: string | null;
};

type UserOption = {
  id: string;
  label: string;
  user: IUserMaster;
};
const STORAGE_KEY = 'support-plan-guide.v2';
const SAVE_DEBOUNCE = 600;
const MAX_DRAFTS = 32;
const NAME_LIMIT = 80;

const FIELD_LIMITS: Record<keyof SupportPlanForm, number> = {
  serviceUserName: 80,
  supportLevel: 200,
  planPeriod: 120,
  assessmentSummary: 900,
  strengths: 600,
  longTermGoal: 450,
  shortTermGoals: 900,
  dailySupports: 1100,
  creativeActivities: 900,
  decisionSupport: 900,
  conferenceNotes: 800,
  monitoringPlan: 800,
  reviewTiming: 450,
  riskManagement: 700,
  complianceControls: 700,
  improvementIdeas: 900,
};

const REQUIRED_FIELDS: Array<keyof SupportPlanForm> = [
  'serviceUserName',
  'supportLevel',
  'planPeriod',
  'assessmentSummary',
  'longTermGoal',
  'shortTermGoals',
  'dailySupports',
  'decisionSupport',
  'monitoringPlan',
  'riskManagement',
];

const FIELD_KEYS = Object.keys(defaultFormState) as Array<keyof SupportPlanForm>;
const TOTAL_FIELDS = FIELD_KEYS.length;

const SECTIONS: SectionConfig[] = [
  {
    key: 'overview',
    label: '基本情報',
    description: '利用者情報と計画期間の骨組みを押さえます。契約内容や医療留意点を簡潔に記載してください。',
    fields: [
      {
        key: 'serviceUserName',
        label: '利用者名 / ID',
        required: true,
        placeholder: '例: 山田 太郎（ID: U123）',
        helper: '本人確認に必要な情報を記載。イニシャル等でも可。',
      },
      {
        key: 'supportLevel',
        label: '支援区分・医療リスク等',
        required: true,
        placeholder: '例: 支援区分4 / 医療的ケア（胃ろう・吸引） / 福祉機器利用あり',
        helper: '障害支援区分や医療連携の要点、合理的配慮の必要性など。',
        quickPhrases: [
          '支援区分:  ／ 主治医:  ／ 服薬:  ／ アレルギー: ',
          '合理的配慮: 視覚情報を強化／静かな環境での説明／選択肢を絵カードで提示',
        ],
      },
      {
        key: 'planPeriod',
        label: '計画期間',
        required: true,
        placeholder: '例: 2025/04/01 〜 2026/03/31（12か月）',
        helper: '初回は契約後1か月以内の作成、以降6か月以内を目安に更新します。',
        quickPhrases: ['初回作成:  年 月 日 ／ 次回見直し目安:  年 月 日'],
      },
    ],
  },
  {
    key: 'assessment',
    label: 'アセスメント',
    description: '生活歴・健康・本人意向などのアセスメント所見を整理します。',
    fields: [
      {
        key: 'assessmentSummary',
        label: 'ニーズ・課題の要約',
        required: true,
        minRows: 4,
        placeholder: '例: 生活リズムは安定しているが、他者交流に不安が強い…',
        helper: '健康、生活歴、本人の希望、家族意向、支援課題を含めましょう。',
        quickPhrases: ['生活歴: ', '健康・医療: ', '本人の希望: ', '家族・相談支援の意向: '],
      },
      {
        key: 'strengths',
        label: '強み・活用資源',
        minRows: 3,
        placeholder: '例: 音楽活動への意欲が高く、家族の送迎支援が安定している…',
        helper: '本人の得意なこと、利用できる社会資源、多職種支援など。',
        quickPhrases: ['本人の強み: ', '家族・地域資源: ', '既存支援: '],
      },
    ],
  },
  {
    key: 'smart',
    label: 'SMART目標',
    description: 'SMARTフレームで長期・短期目標を明確化します。',
    fields: [
      {
        key: 'longTermGoal',
        label: '長期目標（6か月以上）',
        required: true,
        minRows: 3,
        placeholder: '例: 本人の意思表示を尊重しながら、創作活動に主体的に参加できる。',
        helper: 'SMART（具体性／測定可能性／達成可能性／関連性／期限）を意識して記載してください。',
        quickPhrases: ['【SMART】具体性: ／測定可能性: ／達成可能性: ／関連性: ／期限: '],
      },
      {
        key: 'shortTermGoals',
        label: '短期目標（3か月目安）',
        required: true,
        minRows: 4,
        placeholder: '- 週3回の創作活動に参加し、作品を1点完成させる\n- 月1回の個別面談で自己評価を記録する',
        helper: '箇条書き推奨。達成基準や評価方法を明記してください。',
        quickPhrases: ['- 週 回 ／ 月 回（達成基準: ）', '- 面談頻度: 月1回（評価: 支援記録サマリー + 本人ヒアリング）'],
      },
    ],
  },
  {
    key: 'supports',
    label: '支援内容',
    description: '日中支援や創作活動など具体的な提供内容を記載します。',
    fields: [
      {
        key: 'dailySupports',
        label: '日中支援（身体介護・相談等）',
        required: true,
        minRows: 4,
        placeholder: '例: 10:00 入浴介助（支援員2名で移乗）、13:00 相談支援…',
        helper: '5W1Hで誰が、いつ、どこで、何を、どのように行うかを明確に。',
        quickPhrases: [
          '5W1H: 誰( )／何( )／いつ( )／どこで( )／なぜ( )／どのように( )',
          '合理的配慮: 前日リマインド／視覚支援／事前体験',
        ],
      },
      {
        key: 'creativeActivities',
        label: '創作・生産 / 機能訓練',
        minRows: 4,
        placeholder: '例: 火曜 午後: 音楽セッション（外部講師と連携）…',
        helper: 'PT/OT/音楽療法など専門職連携や評価方法を含めましょう。',
        quickPhrases: ['活動内容: ', '役割分担: ', '評価方法: '],
      },
    ],
  },
  {
    key: 'decision',
    label: '意思決定支援',
    description: '本人の意思決定支援プロセスと会議の記録を整理します。',
    fields: [
      {
        key: 'decisionSupport',
        label: '意思決定支援の工夫',
        required: true,
        minRows: 4,
        placeholder: '例: 写真カードで選択肢提示／体験参加でフィードバック収集…',
        helper: '厚労省ガイドラインに沿って、理解しやすい説明や代弁手順を明記。',
        quickPhrases: ['理解容易化: 図解／ピクトグラム／Plain Language', '選択肢提示: 体験参加／試行期間／第三者意見'],
      },
      {
        key: 'conferenceNotes',
        label: 'サービス担当者会議・同意の記録',
        minRows: 3,
        placeholder: '例: 2025/03/15 サービス担当者会議（本人・家族・相談支援・PT参加）…',
        helper: '参加者、合意事項、未決課題、同意日、交付方法を記載。',
        quickPhrases: ['開催日:  ／ 参加者: 本人／家族／相談支援専門員／医師 等', '同意・交付:  年 月 日（本人・家族へ交付済み）'],
      },
    ],
  },
  {
    key: 'monitoring',
    label: 'モニタリング',
    description: '進捗確認と見直しタイミング、評価指標を整理します。',
    fields: [
      {
        key: 'monitoringPlan',
        label: 'モニタリング手法',
        required: true,
        minRows: 4,
        placeholder: '例: 月1回面談＋支援記録レビュー／家族ヒアリング／記録データ分析…',
        helper: '面談頻度、活用する記録、評価指標、担当者を明記してください。',
        quickPhrases: [
          '面談頻度: 月 回（初回3か月は隔週）',
          '評価指標: 参加率／本人満足／職員アンケート',
          '分析方法: 記録ダッシュボード／チェックリスト／ケース会議',
        ],
      },
      {
        key: 'reviewTiming',
        label: '見直しタイミング・判断基準',
        minRows: 3,
        placeholder: '例: 半年ごとに再評価／未達が2期続いた場合は臨時会議…',
        helper: '法定期限・臨時見直し条件・代替案の検討フローなど。',
        quickPhrases: ['定期見直し: 6か月ごと', '臨時見直し:  ／ トリガー: 参加率◯%未満／事故報告 等'],
      },
    ],
  },
  {
    key: 'risk',
    label: 'コンプライアンス・減算対策',
    description: '計画書遅延や同意取得漏れなど、運営指導で指摘されやすいリスクを洗い出し、対応策を整理します。',
    fields: [
      {
        key: 'riskManagement',
        label: '主なリスクと対応策',
        required: true,
        minRows: 4,
        placeholder: '例: 初回30日以内未作成 → 契約アラート設定／議事録テンプレ活用…',
        helper: '遅延、本人不参加、同意未取得、モニタ未実施などの対策を列挙。',
        quickPhrases: ['リスク: 作成遅延／対策: タスク自動通知', 'リスク: 同意書未保管／対策: 電子署名ログ保存'],
      },
      {
        key: 'complianceControls',
        label: '証跡・ダブルチェック手順',
        minRows: 3,
        placeholder: '例: 交付チェックリスト／職員2名確認／SharePoint版管理…',
        helper: '証跡保管、権限管理、バックアップ方法などを記載。',
        quickPhrases: ['証跡: SharePoint記録／紙原本スキャン保存', 'ダブルチェック: サビ管＋主任が同意書を確認'],
      },
    ],
  },
  {
    key: 'excellence',
    label: '改善メモ・連携',
    description: '次回計画に活かす改善提案や、多職種・外部機関との連携アイデアをメモします。',
    fields: [
      {
        key: 'improvementIdeas',
        label: '改善提案 / 次のアクション',
        minRows: 4,
        placeholder: '例: 利用者満足度サーベイ導入／相談支援事業所との月次連携会議を提案…',
        helper: 'データ活用、研修計画、多職種連携など自由に記録してください。',
        quickPhrases: [
          'データ活用: Power BIで支援記録可視化',
          '人材育成: 月次ケーススタディ勉強会',
          '外部連携: 相談支援専門員／医療機関との定例会議',
        ],
      },
    ],
  },
  {
    key: 'preview',
    label: 'プレビュー',
    description: 'Markdownで出力内容を確認し、必要に応じてコピーやダウンロードを行います。',
    fields: [],
  },
];

const sanitizeValue = (value: string, limit: number) => (value.length > limit ? value.slice(0, limit) : value);

const createEmptyForm = (): SupportPlanForm => ({ ...defaultFormState });

const createDraft = (name: string): SupportPlanDraft => {
  const timestamp = new Date().toISOString();
  const id = `draft-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    userId: null,
    userCode: null,
    data: createEmptyForm(),
  };
};

const createDraftForUser = (user: IUserMaster): SupportPlanDraft => {
  const baseName = user.FullName?.trim() || user.UserID?.trim() || `利用者 ${user.Id}`;
  const sanitizedName = sanitizeValue(baseName, NAME_LIMIT);
  const draft = createDraft(sanitizedName);
  draft.name = sanitizedName;
  draft.userId = user.Id;
  draft.userCode = user.UserID ?? null;
  draft.data = {
    ...createEmptyForm(),
    serviceUserName: sanitizedName,
  };
  return draft;
};

const sanitizeForm = (data: Partial<SupportPlanForm> | undefined): SupportPlanForm => {
  const sanitized = createEmptyForm();
  if (!data) {
    return sanitized;
  }
  FIELD_KEYS.forEach((key) => {
    const value = data[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeValue(value, FIELD_LIMITS[key]);
    }
  });
  return sanitized;
};

const computeRequiredCompletion = (form: SupportPlanForm) =>
  Math.round(
    (REQUIRED_FIELDS.reduce((count, key) => (form[key].trim() ? count + 1 : count), 0) / REQUIRED_FIELDS.length) * 100,
  );

const computeFilledCount = (form: SupportPlanForm) =>
  FIELD_KEYS.reduce((count, key) => (form[key].trim() ? count + 1 : count), 0);

const buildMarkdown = (form: SupportPlanForm) => {
  const sections: Array<{ title: string; lines: string[] }> = [
    {
      title: '基本情報',
      lines: [
        form.serviceUserName && `- 利用者名: ${form.serviceUserName}`,
        form.supportLevel && `- 支援区分 / 医療等: ${form.supportLevel}`,
        form.planPeriod && `- 計画期間: ${form.planPeriod}`,
      ].filter(Boolean) as string[],
    },
    {
      title: 'アセスメント要約',
      lines: [
        form.assessmentSummary && form.assessmentSummary,
        form.strengths && `強み・資源: ${form.strengths}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '目標（SMART）',
      lines: [
        form.longTermGoal && `長期目標: ${form.longTermGoal}`,
        form.shortTermGoals && `短期目標: ${form.shortTermGoals}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '具体的支援内容',
      lines: [
        form.dailySupports && `日中支援: ${form.dailySupports}`,
        form.creativeActivities && `創作/生産活動: ${form.creativeActivities}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '意思決定支援・会議記録',
      lines: [
        form.decisionSupport && `意思決定支援: ${form.decisionSupport}`,
        form.conferenceNotes && `サービス担当者会議: ${form.conferenceNotes}`,
      ].filter(Boolean) as string[],
    },
    {
      title: 'モニタリングと見直し',
      lines: [
        form.monitoringPlan && `モニタリング手法: ${form.monitoringPlan}`,
        form.reviewTiming && `見直しタイミング: ${form.reviewTiming}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '減算リスク対策',
      lines: [
        form.riskManagement && `リスク管理: ${form.riskManagement}`,
        form.complianceControls && `コンプラ対策: ${form.complianceControls}`,
      ].filter(Boolean) as string[],
    },
    {
      title: '卓越性・改善提案',
      lines: [form.improvementIdeas && form.improvementIdeas].filter(Boolean) as string[],
    },
  ];

  const sectionsBody = sections
    .map((section) => {
      if (section.lines.length === 0) {
        return '';
      }
      return `## ${section.title}\n${section.lines.join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return sectionsBody ? `# 個別支援計画書ドラフト\n\n${sectionsBody}\n` : '# 個別支援計画書ドラフト\n';
};

const TabPanel: React.FC<{ current: SectionKey; value: SectionKey; children: React.ReactNode }> = ({
  current,
  value,
  children,
}) => (
  <Box
    role="tabpanel"
    hidden={current !== value}
    id={`support-plan-tabpanel-${value}`}
    aria-labelledby={`support-plan-tab-${value}`}
    sx={{ mt: 2 }}
  >
    {current === value ? children : null}
  </Box>
);

export default function SupportPlanGuidePage() {
  const [drafts, setDrafts] = React.useState<Record<string, SupportPlanDraft>>({});
  const [activeDraftId, setActiveDraftId] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<SectionKey>('overview');
  const [previewMode, setPreviewMode] = React.useState<'render' | 'source'>('render');
  const [toast, setToast] = React.useState<ToastState>({ open: false, message: '', severity: 'success' });
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [liveMessage, setLiveMessage] = React.useState('');
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const initialised = React.useRef(false);
  const saveTimer = React.useRef<number>();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { data: masterUsers = [] } = useUsersStore();
  const location = useLocation();
  const [selectedMasterUserId, setSelectedMasterUserId] = React.useState('');
  const userOptions = React.useMemo<UserOption[]>(() => {
    return (masterUsers ?? [])
      .filter((user) => user && user.IsActive !== false)
      .map((user) => {
        const baseName = user.FullName?.trim() || user.UserID?.trim() || `ID:${user.Id}`;
        const sanitizedLabel = sanitizeValue(baseName, NAME_LIMIT);
        const code = user.UserID?.trim();
        const label = code ? `${sanitizedLabel}（${code}）` : sanitizedLabel;
        return {
          id: String(user.Id),
          label,
          user,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
  }, [masterUsers]);

  const draftList = React.useMemo(
    () => Object.values(drafts).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [drafts],
  );
  const activeDraft = activeDraftId ? drafts[activeDraftId] : undefined;
  const form = activeDraft?.data ?? createEmptyForm();
  const markdown = React.useMemo(() => buildMarkdown(form), [form]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initialDraft = createDraft('利用者 1');
        setDrafts({ [initialDraft.id]: initialDraft });
        setActiveDraftId(initialDraft.id);
        initialised.current = true;
        return;
      }
      const parsed = JSON.parse(raw);
      let loadedDrafts: Record<string, SupportPlanDraft> | null = null;
      let loadedActiveId: string | undefined;

      if (parsed?.drafts) {
        const draftEntries: SupportPlanDraft[] = Array.isArray(parsed.drafts)
          ? parsed.drafts
          : Object.values(parsed.drafts);
        loadedDrafts = {};
        draftEntries.slice(0, MAX_DRAFTS).forEach((entry) => {
          if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') {
            return;
          }
          const name =
            typeof entry.name === 'string' && entry.name.length > 0
              ? sanitizeValue(entry.name, NAME_LIMIT)
              : '利用者';
          const createdAt =
            typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
              ? entry.createdAt
              : new Date().toISOString();
          const updatedAt =
            typeof entry.updatedAt === 'string' && !Number.isNaN(Date.parse(entry.updatedAt))
              ? entry.updatedAt
              : createdAt;
          loadedDrafts![entry.id] = {
            id: entry.id,
            name,
            createdAt,
            updatedAt,
            userId: entry.userId ?? null,
            userCode: entry.userCode ?? null,
            data: sanitizeForm(entry.data),
          };
        });
        loadedActiveId =
          typeof parsed.activeDraftId === 'string' && loadedDrafts[parsed.activeDraftId]
            ? parsed.activeDraftId
            : undefined;
        if (parsed?.updatedAt) {
          setLastSavedAt(new Date(parsed.updatedAt).getTime());
        }
      } else if (parsed?.data || FIELD_KEYS.some((key) => typeof parsed?.[key] === 'string')) {
        const legacyData: Partial<SupportPlanForm> = parsed?.data ?? parsed;
        const legacyDraft = createDraft(
          typeof legacyData.serviceUserName === 'string' && legacyData.serviceUserName.trim()
            ? sanitizeValue(legacyData.serviceUserName.trim(), NAME_LIMIT)
            : '利用者 1',
        );
        legacyDraft.data = sanitizeForm(legacyData);
        loadedDrafts = { [legacyDraft.id]: legacyDraft };
        loadedActiveId = legacyDraft.id;
        if (parsed?.updatedAt) {
          setLastSavedAt(new Date(parsed.updatedAt).getTime());
        }
      }

      if (!loadedDrafts || Object.keys(loadedDrafts).length === 0) {
        const fallback = createDraft('利用者 1');
        loadedDrafts = { [fallback.id]: fallback };
        loadedActiveId = fallback.id;
      }

      setDrafts(loadedDrafts);
      setActiveDraftId(loadedActiveId ?? Object.values(loadedDrafts)[0]?.id ?? '');
    } catch (error) {
      console.error('Failed to load draft', error);
    } finally {
      initialised.current = true;
    }
  }, []);

  React.useEffect(() => {
    if (!initialised.current) {
      return;
    }
    const ids = Object.keys(drafts);
    if (ids.length === 0) {
      const fallback = createDraft('利用者 1');
      setDrafts({ [fallback.id]: fallback });
      setActiveDraftId(fallback.id);
      return;
    }
    if (!activeDraftId || !drafts[activeDraftId]) {
      setActiveDraftId(ids[0]);
    }
  }, [drafts, activeDraftId]);

  React.useEffect(() => {
    if (!initialised.current) {
      return;
    }
    const params = new URLSearchParams(location.search);
    const targetId = params.get('userId');
    if (!targetId) {
      return;
    }
    const option = userOptions.find((candidate) => candidate.id === targetId);
    if (!option) {
      return;
    }
    const existing = draftList.find(
      (draft) => draft.userId != null && String(draft.userId) === targetId,
    );
    if (existing) {
      setActiveDraftId(existing.id);
      setActiveTab('overview');
      return;
    }
    if (draftList.length >= MAX_DRAFTS) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      return;
    }
    const newDraft = createDraftForUser(option.user);
    setDrafts((prev) => ({
      ...prev,
      [newDraft.id]: newDraft,
    }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
  }, [draftList, location.search, userOptions]);
  React.useEffect(() => {
    if (!initialised.current) {
      return;
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      try {
        const payload = {
          version: 2,
          updatedAt: new Date().toISOString(),
          activeDraftId,
          drafts,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const now = Date.now();
        setLastSavedAt(now);
        setLiveMessage(`自動保存しました（${new Date(now).toLocaleTimeString('ja-JP')}）`);
      } catch (error) {
        console.error('Failed to persist draft', error);
        setLiveMessage('自動保存に失敗しました');
      }
    }, SAVE_DEBOUNCE);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [drafts, activeDraftId]);

  React.useEffect(() => {
    if (!liveMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setLiveMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [liveMessage]);

  const handleFieldChange = (key: keyof SupportPlanForm, value: string) => {
    if (!activeDraftId) {
      return;
    }
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) {
        return prev;
      }
      const updatedData = {
        ...target.data,
        [key]: sanitizeValue(value, FIELD_LIMITS[key]),
      };
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: updatedData,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleAppendPhrase = (key: keyof SupportPlanForm, phrase: string) => {
    if (!activeDraftId) {
      return;
    }
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) {
        return prev;
      }
      const currentValue = target.data[key];
      const separator = currentValue ? (currentValue.trimEnd().endsWith('\n') ? '' : '\n') : '';
      const nextValue = `${currentValue ? currentValue.trimEnd() : ''}${separator}${phrase}`.trimStart();
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: {
            ...target.data,
            [key]: sanitizeValue(nextValue, FIELD_LIMITS[key]),
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleReset = () => {
    if (!activeDraftId) {
      return;
    }
    if (!window.confirm(`${activeDraft?.name ?? 'この利用者'}の入力内容をすべてリセットしますか？`)) {
      return;
    }
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) {
        return prev;
      }
      const resetForm = createEmptyForm();
      resetForm.serviceUserName = sanitizeValue(target.name, FIELD_LIMITS.serviceUserName);
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: resetForm,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    setActiveTab('overview');
    setToast({ open: true, message: `${activeDraft?.name ?? '利用者'}のフォームを初期化しました`, severity: 'success' });
  };

  const handleCopyMarkdown = async () => {
    if (!activeDraft) {
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      setToast({
        open: true,
        message: `${activeDraft.name || '利用者'}のMarkdownをコピーしました`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to copy markdown', error);
      setToast({ open: true, message: 'コピーに失敗しました。ブラウザ設定をご確認ください。', severity: 'error' });
    }
  };

  const triggerDownload = (content: BlobPart, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = {
      version: 2,
      updatedAt: new Date().toISOString(),
      activeDraftId,
      drafts,
    };
    triggerDownload(JSON.stringify(payload, null, 2), 'support-plan-draft.json', 'application/json');
    setToast({ open: true, message: 'JSONをダウンロードしました', severity: 'info' });
  };

  const handleDownloadMarkdown = () => {
    if (!activeDraft) {
      return;
    }
    triggerDownload(markdown, `${activeDraft.name || 'support-plan'}-draft.md`, 'text/markdown');
    setToast({ open: true, message: `${activeDraft.name || '利用者'}のMarkdownをダウンロードしました`, severity: 'info' });
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let nextDrafts: Record<string, SupportPlanDraft> | null = null;
      let nextActiveId: string | undefined;

      if (parsed?.drafts) {
        const entries: SupportPlanDraft[] = Array.isArray(parsed.drafts)
          ? parsed.drafts
          : Object.values(parsed.drafts);
        nextDrafts = {};
        entries.slice(0, MAX_DRAFTS).forEach((entry) => {
          if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') {
            return;
          }
          const name =
            typeof entry.name === 'string' && entry.name.length > 0
              ? sanitizeValue(entry.name, NAME_LIMIT)
              : '利用者';
          const createdAt =
            typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
              ? entry.createdAt
              : new Date().toISOString();
          const updatedAt =
            typeof entry.updatedAt === 'string' && !Number.isNaN(Date.parse(entry.updatedAt))
              ? entry.updatedAt
              : createdAt;
          nextDrafts![entry.id] = {
            id: entry.id,
            name,
            createdAt,
            updatedAt,
            userId: entry.userId ?? null,
            userCode: entry.userCode ?? null,
            data: sanitizeForm(entry.data),
          };
        });
        nextActiveId =
          typeof parsed.activeDraftId === 'string' && nextDrafts[parsed.activeDraftId]
            ? parsed.activeDraftId
            : undefined;
      } else if (parsed?.data || FIELD_KEYS.some((key) => typeof parsed?.[key] === 'string')) {
        const data: Partial<SupportPlanForm> = parsed?.data ?? parsed;
        const draft = createDraft(
          typeof data.serviceUserName === 'string' && data.serviceUserName.trim()
            ? sanitizeValue(data.serviceUserName.trim(), NAME_LIMIT)
            : '利用者 1',
        );
        draft.data = sanitizeForm(data);
        draft.userId = null;
        draft.userCode = null;
        nextDrafts = { [draft.id]: draft };
        nextActiveId = draft.id;
      }

      if (!nextDrafts || Object.keys(nextDrafts).length === 0) {
        throw new Error('Invalid payload');
      }

      setDrafts(nextDrafts);
      setActiveDraftId(nextActiveId ?? Object.values(nextDrafts)[0].id);
      setActiveTab('overview');
      setToast({ open: true, message: 'JSONを読み込みました', severity: 'success' });
    } catch (error) {
      console.error('Failed to import JSON', error);
      setToast({ open: true, message: 'JSONの読み込みに失敗しました', severity: 'error' });
    } finally {
      event.target.value = '';
    }
  };

  const requiredCompleted = REQUIRED_FIELDS.reduce(
    (count, key) => (form[key].trim() ? count + 1 : count),
    0,
  );
  const filledCount = computeFilledCount(form);
  const completionPercent = Math.round((requiredCompleted / REQUIRED_FIELDS.length) * 100);
  const maxDraftsReached = draftList.length >= MAX_DRAFTS;

  const handleAddDraft = () => {
    if (maxDraftsReached) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      return;
    }
    const nextIndex = draftList.length + 1;
    const newDraft = createDraft(`利用者 ${nextIndex}`);
    setDrafts((prev) => ({ ...prev, [newDraft.id]: newDraft }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
    setToast({ open: true, message: `${newDraft.name}を追加しました`, severity: 'success' });
  };

  const handleMasterUserChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (!value) {
      setSelectedMasterUserId('');
      return;
    }

    setSelectedMasterUserId(value);
    const option = userOptions.find((candidate) => candidate.id === value);
    const user = option?.user;
    if (!user) {
      setSelectedMasterUserId('');
      return;
    }

    const existing = draftList.find(
      (draft) => draft.userId != null && String(draft.userId) === value,
    );
    if (existing) {
      setActiveDraftId(existing.id);
      setActiveTab('overview');
      setToast({
        open: true,
        message: `${user.FullName}のドラフトを開きました`,
        severity: 'info',
      });
      setSelectedMasterUserId('');
      return;
    }

    if (maxDraftsReached) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      setSelectedMasterUserId('');
      return;
    }

    const newDraft = createDraftForUser(user);
    setDrafts((prev) => ({
      ...prev,
      [newDraft.id]: newDraft,
    }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
    setToast({
      open: true,
      message: `${user.FullName}のドラフトを作成しました`,
      severity: 'success',
    });
    setSelectedMasterUserId('');
  };

  const handleDeleteDraft = () => {
    if (!activeDraftId || draftList.length <= 1) {
      setToast({ open: true, message: '少なくとも1名のドラフトが必要です', severity: 'info' });
      return;
    }
    const targetName = drafts[activeDraftId]?.name ?? '利用者';
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activeDraftId];
      return next;
    });
    setActiveDraftId('');
    setToast({ open: true, message: `${targetName}を削除しました`, severity: 'success' });
  };

  const handleRenameDraft = (name: string) => {
    if (!activeDraftId) {
      return;
    }
    let nextName = sanitizeValue(name, NAME_LIMIT);
    if (!nextName.trim()) {
      nextName = '未設定の利用者';
    }

    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) {
        return prev;
      }
      const updatedData: SupportPlanForm = {
        ...target.data,
        serviceUserName: nextName,
      };
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          name: nextName,
          data: updatedData,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const getDraftProgressChip = (draft: SupportPlanDraft) => {
    const progress = computeRequiredCompletion(draft.data);
    const lastUpdated = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString('ja-JP') : '未記録';
    const displayName = draft.name.trim() || '未設定の利用者';
    const code = draft.userCode?.trim();
    const chipLabel = `${displayName}${code ? ` / ${code}` : ''} (${progress}%)`;
    const tooltipParts = [`必須達成: ${progress}%`, `最終更新: ${lastUpdated}`];
    if (code) {
      tooltipParts.push(`利用者コード: ${code}`);
    }
    if (draft.userId != null) {
      tooltipParts.push(`レコードID: ${draft.userId}`);
    }
    const linkedToMaster = draft.userId != null;

    return (
      <Tooltip key={draft.id} title={tooltipParts.join(' ・ ')} arrow>
        <Chip
          icon={linkedToMaster ? <VerifiedUserRoundedIcon fontSize="small" /> : undefined}
          clickable
          color={draft.id === activeDraftId ? 'primary' : 'default'}
          label={chipLabel}
          onClick={() => {
            setActiveDraftId(draft.id);
            setActiveTab('overview');
          }}
        />
      </Tooltip>
    );
  };

  const renderFieldCard = (field: FieldConfig) => {
    const value = form[field.key];
    const limit = FIELD_LIMITS[field.key];
    const remaining = limit - value.length;
    const isOverLimit = remaining < 0;

    return (
      <Paper key={field.key} variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Stack spacing={0.5} flex={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" component="h3">
                  {field.label}
                </Typography>
                {field.required ? <Chip label="必須" size="small" color="error" variant="outlined" /> : null}
              </Stack>
              {field.helper ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {field.helper}
                </Typography>
              ) : null}
            </Stack>
            <Chip
              size="small"
              label={`${Math.max(remaining, 0)} 文字残り`}
              color={isOverLimit ? 'error' : remaining <= 50 ? 'warning' : 'default'}
            />
          </Stack>

          {field.quickPhrases && field.quickPhrases.length > 0 ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {field.quickPhrases.map((phrase) => (
                <Chip
                  key={phrase}
                  size="small"
                  variant="outlined"
                  label={phrase}
                  onClick={() => handleAppendPhrase(field.key, phrase)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          ) : null}

          <TextField
            value={value}
            onChange={(event) => handleFieldChange(field.key, event.target.value)}
            placeholder={field.placeholder}
            multiline
            minRows={field.minRows ?? 2}
            fullWidth
            inputProps={{ maxLength: limit }}
          />
        </Stack>
      </Paper>
    );
  };

  const renderPreviewTab = () => (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" component="h3">
              Markdownプレビュー
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={previewMode}
              exclusive
              onChange={(_event, next) => next && setPreviewMode(next)}
              aria-label="プレビュー表示切り替え"
            >
              <ToggleButton value="render" aria-label="レンダリング表示">
                レンダリング
              </ToggleButton>
              <ToggleButton value="source" aria-label="ソース表示">
                ソース
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={handleDownloadMarkdown}
              disabled={!activeDraft}
            >
              Markdown保存
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={handleCopyMarkdown}
              disabled={!activeDraft}
            >
              Markdownコピー
            </Button>
          </Stack>
        </Stack>
        <Divider />
        {previewMode === 'render' ? (
          <Box
            sx={{
              '& h2': { fontSize: 18, mt: 2 },
              '& p': { whiteSpace: 'pre-wrap' },
              '& ul': { pl: 4 },
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </Box>
        ) : (
          <Box
            component="pre"
            sx={{
              fontFamily: 'Menlo, Consolas, monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              m: 0,
            }}
          >
            {markdown}
          </Box>
        )}
      </Stack>
    </Paper>
  );

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
        <DescriptionRoundedIcon color="primary" fontSize="large" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" component="h1">
            個別支援計画書ガイド（生活介護）
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            32名までの利用者ドラフトを切り替えながら、現場で使いやすい計画書を作成できます。
          </Typography>
        </Box>
        <Tooltip title="Markdownガイドを開く">
          <Button
            size="small"
            variant="outlined"
            startIcon={<ArticleRoundedIcon />}
            component="a"
            href="/guides/support-plan-guide.md"
            target="_blank"
            rel="noreferrer"
          >
            詳細ガイド
          </Button>
        </Tooltip>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Typography variant="subtitle1">利用者ドラフト管理</Typography>
            <Chip size="small" label={`${draftList.length}/${MAX_DRAFTS} 名`} />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="support-plan-user-select-label">利用者</InputLabel>
              <Select
                labelId="support-plan-user-select-label"
                value={activeDraftId && drafts[activeDraftId] ? activeDraftId : draftList[0]?.id ?? ''}
                label="利用者"
                onChange={(event: SelectChangeEvent<string>) => setActiveDraftId(event.target.value)}
              >
                {draftList.map((draft) => (
                  <MenuItem key={draft.id} value={draft.id}>
                    {draft.name.trim() || '未設定の利用者'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              size="small"
              sx={{ minWidth: 240 }}
              disabled={userOptions.length === 0}
            >
              <InputLabel id="support-plan-user-master-select-label">利用者マスタから追加</InputLabel>
              <Select
                labelId="support-plan-user-master-select-label"
                value={selectedMasterUserId}
                label="利用者マスタから追加"
                onChange={handleMasterUserChange}
                displayEmpty
              >
                <MenuItem value="">
                  <em>未選択</em>
                </MenuItem>
                {userOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="利用者の表示名"
              value={activeDraft?.name ?? ''}
              onChange={(event) => handleRenameDraft(event.target.value)}
              fullWidth
              placeholder="例: 山田 太郎"
            />
            <Stack direction="row" spacing={1}>
              <Tooltip title={maxDraftsReached ? '最大32名まで' : '利用者ドラフトを追加'}>
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<PersonAddRoundedIcon />}
                    onClick={handleAddDraft}
                    disabled={maxDraftsReached}
                  >
                    追加
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="この利用者ドラフトを削除">
                <span>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={handleDeleteDraft}
                    disabled={!activeDraft || draftList.length <= 1}
                  >
                    削除
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {draftList.map((draft) => getDraftProgressChip(draft))}
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1">
                  必須項目の完了率（{activeDraft?.name.trim() || '未設定の利用者'}）
                </Typography>
                <Chip
                  size="small"
                  icon={<CheckCircleRoundedIcon fontSize="small" />}
                  label={`${requiredCompleted}/${REQUIRED_FIELDS.length}`}
                  color={completionPercent === 100 ? 'success' : 'default'}
                />
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                入力済み: {filledCount}/{TOTAL_FIELDS} 項目
              </Typography>
              {lastSavedAt ? (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  最終自動保存: {new Date(lastSavedAt).toLocaleTimeString('ja-JP')}
                </Typography>
              ) : null}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <input
                type="file"
                accept="application/json"
                ref={fileInputRef}
                onChange={handleImportJson}
                style={visuallyHidden as React.CSSProperties}
              />
              <Tooltip title="JSONを読み込み">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FileUploadRoundedIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  JSON読み込み
                </Button>
              </Tooltip>
              <Tooltip title="JSONとして保存">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FileDownloadRoundedIcon />}
                  onClick={handleExportJson}
                >
                  JSON保存
                </Button>
              </Tooltip>
            </Stack>
          </Stack>
          <LinearProgress variant="determinate" value={completionPercent} />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ px: { xs: 1, sm: 2 }, pt: 1, pb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_event, next) => setActiveTab(next)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="計画書セクション切り替え"
        >
          {SECTIONS.map((section) => {
            const filled = section.fields.filter((field) => form[field.key].trim()).length;
            const total = section.fields.length || 1;
            return (
              <Tab
                key={section.key}
                value={section.key}
                id={`support-plan-tab-${section.key}`}
                aria-controls={`support-plan-tabpanel-${section.key}`}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{section.label}</span>
                    {section.key !== 'preview' ? (
                      <Chip size="small" label={`${filled}/${total}`} variant="outlined" />
                    ) : null}
                  </Stack>
                }
              />
            );
          })}
        </Tabs>
      </Paper>

      {SECTIONS.map((section) => (
        <TabPanel key={section.key} value={section.key} current={activeTab}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {section.description}
          </Typography>
          {section.key === 'preview' ? (
            renderPreviewTab()
          ) : (
            <Stack spacing={2}>
              {section.fields.map((field) => renderFieldCard(field))}
            </Stack>
          )}
        </TabPanel>
      ))}

      <Box
        sx={{
          ...visuallyHidden,
        }}
        aria-live="polite"
        role="status"
      >
        {liveMessage}
      </Box>

      {isDesktop ? (
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button color="inherit" startIcon={<RestartAltRoundedIcon />} onClick={handleReset} disabled={!activeDraft}>
            リセット
          </Button>
          <Button
            variant="contained"
            startIcon={<ContentCopyRoundedIcon />}
            onClick={handleCopyMarkdown}
            disabled={!activeDraft}
          >
            Markdownコピー
          </Button>
        </Stack>
      ) : (
        <Paper
          elevation={6}
          sx={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            py: 1,
            px: 2,
            borderRadius: 0,
            display: 'flex',
            gap: 1,
            justifyContent: 'space-between',
            backgroundColor: (themeArg) => themeArg.palette.background.paper,
          }}
        >
          <Button
            color="inherit"
            startIcon={<RestartAltRoundedIcon />}
            onClick={handleReset}
            sx={{ flex: 1 }}
            disabled={!activeDraft}
          >
            リセット
          </Button>
          <Button
            variant="contained"
            startIcon={<ContentCopyRoundedIcon />}
            onClick={handleCopyMarkdown}
            sx={{ flex: 1 }}
            disabled={!activeDraft}
          >
            コピー
          </Button>
        </Paper>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
