import {
    AutoAwesome as AutoAwesomeIcon,
    CheckCircle as CheckCircleIcon,
    Edit as EditIcon,
    ExpandMore as ExpandMoreIcon,
    Favorite as FavoriteIcon,
    HealthAndSafety as HealthIcon,
    Info as InfoIcon,
    Psychology as PsychologyIcon,
    Schedule as ScheduleIcon,
    Support as SupportIcon,
} from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    Collapse,
    Divider,
    Paper,
    Snackbar,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
    FormControlLabel,
    Switch,
} from '@mui/material';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import BehaviorSupportPlanBuilder from '../features/behavior-plan/BehaviorSupportPlanBuilder';
import {
  abcOptionMap,
  coerceEnvFactorId,
  coerceMoodId,
  coercePersonFactorId,
  coerceStrengthId,
  envFactors,
  moodOptions,
  moodsById,
  personFactors,
  strengthTags,
} from '../config/master';
import type { EnvFactorId, MoodId, PersonFactorId, StrengthId } from '../config/master';
import { useRecommendations } from '../features/recommendations/useRecommendations';
import { getUserProfile } from '@/adapters/userProfile.api';
import { profileToAssessmentLiteDefaults } from '@/features/assessment/bridge';
import type { BehaviorSupportPlan, FlowSupportActivityTemplate } from '../types/behaviorPlan';

// Feature flag (default off)
const FEATURE_SUPPORT_CDS = String(import.meta.env.VITE_FEATURE_SUPPORT_CDS || 'false') === 'true';

type TabValue = 'plan' | 'records' | 'createPlan' | 'updatePlan';

interface SupportSection {
  id: string;
  title: string;
  description: string[];
  color: string;
  icon: React.ReactNode;
}

interface ScheduleSlot {
  id: string;
  time: string;
  activity: string;
  selfTasks: string[];
  supporterTasks: string[];
  isRecorded: boolean;
}

interface ABCSelection {
  antecedent: string;
  behavior: string;
  consequence: string;
}

interface SlotFormState {
  moodId: MoodId | null;
  note: string;
  showABC: boolean;
  abc: ABCSelection;
  error: string | null;
}

interface TimelineEntry {
  id: string;
  time: string;
  activity: string;
  moodId: MoodId;
  note: string;
  abc?: ABCSelection;
  recordedAt: string;
}

// ---- AssessmentLite & CDS Types (local, minimal) ----
type StrengthTag = StrengthId;
type IcebergFactor = {
  kind: 'person'|'environment';
  id: PersonFactorId | EnvFactorId;
  label: string;
  note?: string;
};
type ABARecordLite = { A?: string; B?: string; C?: string; };

export interface AssessmentLite {
  strengths: StrengthTag[];
  iceberg: IcebergFactor[];
  aba?: ABARecordLite;
  notes?: string;
  updatedAt?: string;
}

const sanitizeAssessmentLite = (input: AssessmentLite): AssessmentLite => {
  const strengths = Array.from(
    new Set(
      (input.strengths ?? [])
        .map((candidate) => coerceStrengthId(candidate))
        .filter((id): id is StrengthId => Boolean(id)),
    ),
  );

  const iceberg = (input.iceberg ?? []).reduce<IcebergFactor[]>((acc, factor) => {
    const normalizedId =
      factor.kind === 'person'
        ? coercePersonFactorId(factor.id ?? factor.label)
        : coerceEnvFactorId(factor.id ?? factor.label);
    if (!normalizedId) {
      return acc;
    }
    const catalogOption =
      factor.kind === 'person'
        ? personFactors.find((option) => option.id === normalizedId)
        : envFactors.find((option) => option.id === normalizedId);
    if (!catalogOption) {
      return acc;
    }
    acc.push({
      kind: factor.kind,
      id: catalogOption.id,
      label: catalogOption.label,
      note: factor.note?.trim() || undefined,
    });
    return acc;
  }, []);

  const aba = input.aba
    ? {
        A: input.aba.A?.trim() || undefined,
        B: input.aba.B?.trim() || undefined,
        C: input.aba.C?.trim() || undefined,
      }
    : undefined;

  return {
    strengths,
    iceberg,
    aba,
    notes: input.notes?.trim() || undefined,
    updatedAt: input.updatedAt,
  };
};

// ---- Foldout UI: inline assessment (Strengths / Iceberg / ABA) ----
export const AssessmentFoldout: React.FC<{
  value: AssessmentLite;
  onChange: (val: AssessmentLite) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const toggleTag = (option: (typeof strengthTags)[number]) => {
    const has = value.strengths.includes(option.id);
    onChange({
      ...value,
      strengths: has
        ? value.strengths.filter((id) => id !== option.id)
        : [...value.strengths, option.id],
    });
  };

  const toggleIceberg = (
    kind:'person'|'environment',
    option: (typeof personFactors)[number] | (typeof envFactors)[number],
  ) => {
    const exists = value.iceberg.find((f) => f.kind === kind && f.id === option.id);
    onChange({
      ...value,
      iceberg: exists
        ? value.iceberg.filter((f) => !(f.kind === kind && f.id === option.id))
        : [
            ...value.iceberg,
            {
              kind,
              id: option.id,
              label: option.label,
            },
          ],
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>評価の追記（強み / 氷山 / ABA）</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={open}
              onChange={(_, v) => setOpen(v)}
              slotProps={{
                root: {
                  'aria-controls': panelId,
                  'aria-expanded': open ? 'true' : 'false',
                },
                input: {
                  'aria-controls': panelId,
                  'aria-expanded': open ? 'true' : 'false',
                },
              }}
            />
          }
          label={open ? '閉じる' : '開く'}
        />
      </Stack>

      <Collapse in={open} id={panelId}>
        <Stack spacing={2} mt={2}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>強み（複数選択可）</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {strengthTags.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  onClick={() => toggleTag(option)}
                  color={value.strengths.includes(option.id) ? 'primary' : 'default'}
                  variant={value.strengths.includes(option.id) ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>氷山モデル（水面下要因）</Typography>
            <Typography variant="caption" color="text.secondary">本人特性</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
              {personFactors.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  onClick={()=>toggleIceberg('person', option)}
                  color={value.iceberg.some(f=>f.kind==='person' && f.id===option.id) ? 'primary':'default'}
                  variant={value.iceberg.some(f=>f.kind==='person' && f.id===option.id) ? 'filled':'outlined'}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">環境・状況</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {envFactors.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  onClick={()=>toggleIceberg('environment', option)}
                  color={value.iceberg.some(f=>f.kind==='environment' && f.id===option.id) ? 'primary':'default'}
                  variant={value.iceberg.some(f=>f.kind==='environment' && f.id===option.id) ? 'filled':'outlined'}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>ABA（A-B-Cのメモ）</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {(['A','B','C'] as const).map(k => (
                <TextField key={k} label={k} size="small" value={(value.aba?.[k] ?? '')} onChange={(e)=> onChange({ ...value, aba: { ...(value.aba ?? {}), [k]: e.target.value } })} />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Collapse>
    </Paper>
  );
};

const targetName = '山田 太郎 様';

const supportSections: SupportSection[] = [
  {
    id: 'prevention',
    title: '落ち着いている時に気をつけること',
    description: [
      '朝の挨拶では必ず視線を合わせ、落ち着いた声で伝えます。',
      '活動の切り替え前に「あと5分で次の活動です」と予告します。',
      '安心して過ごせるよう、好きな音楽をバックグラウンドで流します。',
    ],
    color: 'info.light',
    icon: <HealthIcon fontSize="small" sx={{ mr: 1 }} />,
  },
  {
    id: 'skills',
    title: '行動の置き換えで気をつけること',
    description: [
      '選択肢を2つ提示し、自分で選べたことを褒めます。',
      '感情カードを使って気持ちを言葉で表現する練習をします。',
      '成功体験を振り返り、自信を高める声掛けを行います。',
    ],
    color: 'success.light',
    icon: <PsychologyIcon fontSize="small" sx={{ mr: 1 }} />,
  },
  {
    id: 'crisis',
    title: '緊急時対応（強いこだわり・パニックの兆候）',
    description: [
      '深呼吸の誘導と静かな声掛けで状況を受け止めます。',
      '安全を確保し、余分な刺激（音・光）を減らします。',
      '落ち着いたら「どうしたかった？」と確認し、再発予防の手立てを検討します。',
    ],
    color: 'warning.light',
    icon: <InfoIcon fontSize="small" sx={{ mr: 1 }} />,
  },
];

const initialSchedule: ScheduleSlot[] = [
  {
    id: 'slot-0900',
    time: '09:00',
    activity: '朝の会',
    selfTasks: ['朝の挨拶をする', '今日の予定を一緒に確認する'],
    supporterTasks: ['視覚支援ボードを提示する', '落ち着いたトーンで進行をサポートする'],
    isRecorded: false,
  },
  {
    id: 'slot-1000',
    time: '10:00',
    activity: '感覚統合活動',
    selfTasks: ['ボールプールで体を動かす', '5分間のスイングを楽しむ'],
    supporterTasks: ['安全な範囲での動きを見守る', '手順の切り替えを予告する'],
    isRecorded: false,
  },
  {
    id: 'slot-1200',
    time: '12:00',
    activity: '昼食',
    selfTasks: ['自分の席に座り、手を合わせて挨拶する', '好きなおかずから食べ始める'],
    supporterTasks: ['食具の配置を整える', '落ち着いたペースで食べられるよう声掛けする'],
    isRecorded: false,
  },
  {
    id: 'slot-1500',
    time: '15:00',
    activity: '帰りの支度',
    selfTasks: ['持ち物チェックリストを確認する', 'スタッフに今日楽しかったことを伝える'],
    supporterTasks: ['チェックリストを一緒に指差し確認する', '達成したことを振り返りながら褒める'],
    isRecorded: false,
  },
];

const buildInitialFormState = (schedule: ScheduleSlot[]): Record<string, SlotFormState> => {
  return schedule.reduce<Record<string, SlotFormState>>((acc, slot) => {
    acc[slot.id] = {
      moodId: null,
      note: '',
      showABC: false,
      abc: {
        antecedent: '',
        behavior: '',
        consequence: '',
      },
      error: null,
    };
    return acc;
  }, {});
};

const createSampleDailyActivities = (): FlowSupportActivityTemplate[] => ([
  {
    time: '09:30',
    title: '朝の会: 自己紹介ロールプレイ',
    personTodo: '好きなカードを選び、挙手して順番を守りながら自己紹介する。',
    supporterTodo: '視覚カードで進行を示し、成功ポイントを即時フィードバックする。',
    stage: 'proactive',
  },
  {
    time: '10:45',
    title: '感情カードで気持ちを共有',
    personTodo: '今の気持ちを感情カードから選び、言葉で伝える。',
    supporterTodo: '選択肢を2枚に絞り、言語モデルを提示して表現を促す。',
    stage: 'proactive',
  },
  {
    time: '13:00',
    title: '昼食前のリクエスト練習',
    personTodo: '絵カードを用いて食べたいものをリクエストする。',
    supporterTodo: '適切な要求が出た際は即時強化し、言語化をサポートする。',
    stage: 'earlyResponse',
  },
  {
    time: '15:30',
    title: 'クールダウンルーティン',
    personTodo: '深呼吸とセルフラベリングで情動を整える。',
    supporterTodo: 'クールダウンカードを提示し、声掛けは最小限に抑える。',
    stage: 'earlyResponse',
  },
]);

const createArchivedPlanV1 = (): BehaviorSupportPlan => ({
  planId: 'bsp-user001-v1',
  userId: 'user001',
  version: 1,
  status: 'ARCHIVED',
  createdAt: '2023-10-01T09:00:00.000Z',
  updatedAt: '2024-01-05T09:00:00.000Z',
  authorId: 'staff-core001',
  assessmentSummary: {
    kodoScore: 19,
    functionalHypothesis: ['課題逃避'],
    assessmentNotes: '初期評価では活動切り替え時の高負荷が確認され、予告支援が必須と判断。',
  },
  proactiveStrategies: [
    '### 活動切り替え時の予告',
    '- 5分前と1分前の二段階予告を行う。',
    '- スケジュールボードを共有し、視覚的に次の活動を確認する。',
  ].join('\n'),
  skillBuildingPlan: [
    '### 基本的な要求スキル',
    '- カード交換で水分補給をリクエストする練習を1日3回実施。',
    '- 成功時は口頭とトークンで強化し、次第にトークンへ移行する。',
  ].join('\n'),
  crisisResponseFlow: { xml: '<!-- archived plan v1 -->' },
  monitoringHistory: [],
  dailyActivities: createSampleDailyActivities(),
});

const createActivePlanV2 = (): BehaviorSupportPlan => ({
  planId: 'bsp-user001-v2',
  userId: 'user001',
  version: 2,
  status: 'ACTIVE',
  createdAt: '2024-01-05T09:00:00.000Z',
  updatedAt: '2024-04-01T09:00:00.000Z',
  authorId: 'staff-core001',
  assessmentSummary: {
    kodoScore: 21,
    functionalHypothesis: ['注目獲得', '課題逃避'],
    assessmentNotes: '感覚刺激の事前調整と予告が行動抑制に有効であることが確認された。',
  },
  proactiveStrategies: [
    '### 環境調整',
    '- 午前中は遮音イヤーマフを準備し、刺激量をコントロールする。',
    '- 活動ごとに役割を明確化し、成功イメージを共有する。',
    '',
    '### コミュニケーション支援',
    '- 視覚支援ボードを活用し、行動選択を短時間で行えるようにする。',
  ].join('\n'),
  skillBuildingPlan: [
    '### 代替スキル獲得プログラム',
    '- 感情カードとセルフモニタリングシートを使用した自己調整スキルの定着を目指す。',
    '- 昼食前後にトークンエコノミーを導入し、適切な要求行動を強化する。',
  ].join('\n'),
  crisisResponseFlow: {
    xml: '<!-- BPMN placeholder: active plan v2 -->',
    redFlags: [
      { elementId: 'Task_Escalate', reason: '身体拘束は禁止。退避時は距離と見守りで対応する。' },
    ],
  },
  monitoringHistory: [
    {
      date: '2024-01-05T09:00:00.000Z',
      summary: 'v1の評価を踏まえ、課題切り替え時の予告と感覚調整を重点化。',
      previousVersionId: 'bsp-user001-v1',
    },
  ],
  dailyActivities: createSampleDailyActivities(),
});

const createDraftPlanV3 = (): BehaviorSupportPlan => {
  const draftActivities: FlowSupportActivityTemplate[] = [
    ...createSampleDailyActivities(),
    {
      time: '16:00',
      title: '1日の振り返りと自己強化',
      personTodo: '成功したことをカードで選び、スタッフに共有する。',
      supporterTodo: '振り返りカードを用いて具体的な称賛をフィードバックする。',
      stage: 'earlyResponse',
    },
  ];

  return {
    planId: 'bsp-user001-v3',
    userId: 'user001',
    version: 3,
    status: 'DRAFT',
    createdAt: '2024-06-15T09:00:00.000Z',
    updatedAt: '2024-06-15T09:00:00.000Z',
    authorId: 'staff-core001',
    assessmentSummary: {
      kodoScore: 24,
      functionalHypothesis: ['注目獲得', '課題逃避', '感覚刺激'],
      assessmentNotes: '第2四半期モニタリングで自己評価カードの導入ニーズが確認された。',
    },
    proactiveStrategies: [
      '### 朝の立ち上がり',
      '- 起床後30分以内に感覚刺激（深圧ハグクッション）を提供し、覚醒を安定させる。',
      '',
      '### 昼食前予告',
      '- 食事前に必ず視覚カードを使用し、「あと3分」「あと1分」で予告する。',
    ].join('\n'),
    skillBuildingPlan: [
      '### 自己評価カードの活用',
      '- 午後の活動後に自己評価カードを使い、達成感と言語化のスキルを育てる。',
      '- 成功時は行動契約ノートに貼り付け、家族と共有する。',
    ].join('\n'),
    crisisResponseFlow: {
      xml: '<!-- BPMN placeholder: draft plan v3 -->',
      redFlags: [
        { elementId: 'Task_Escalate', reason: '合理的配慮に反する身体拘束は禁止。応援要請手順を優先。' },
      ],
    },
    monitoringHistory: [
      {
        date: '2024-06-10T09:00:00.000Z',
        summary: '第2四半期モニタリング結果: 休憩前の代替行動が定着。次期は自己認知スキルを強化する。',
        previousVersionId: 'bsp-user001-v2',
      },
    ],
    dailyActivities: draftActivities,
  };
};

const IndividualSupportManagementPage: React.FC = () => {
  const { userId: paramUserId } = useParams<{ userId: string }>();
  const userId = paramUserId ?? 'user001';
  const [tab, setTab] = useState<TabValue>('plan');
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>(initialSchedule);
  const [formState, setFormState] = useState<Record<string, SlotFormState>>(() => buildInitialFormState(initialSchedule));
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  );
  // CDS/Assessment (local, feature-flagged)
  const [assessmentLite, setAssessmentLite] = useState<AssessmentLite>(() =>
    sanitizeAssessmentLite({
      strengths: [],
      iceberg: [],
      aba: undefined,
    }),
  );
  useEffect(() => {
    let alive = true;
    void (async () => {
      const profile = await getUserProfile(userId);
      if (!alive) {
        return;
      }
      const defaults = profileToAssessmentLiteDefaults(profile);
      setAssessmentLite((prev) =>
        sanitizeAssessmentLite({
          ...defaults,
          aba: prev.aba ?? defaults.aba,
          notes: prev.notes ?? undefined,
        } as AssessmentLite),
      );
    })();
    return () => {
      alive = false;
    };
  }, [userId]);
  // Which slot accordion is open (for targeting notes insertion)
  const [expandedSlotId, setExpandedSlotId] = useState<string | false>(false);
  const currentSlotState = typeof expandedSlotId === 'string' ? formState[expandedSlotId] : undefined;
  const currentSlotMoodId = coerceMoodId(currentSlotState?.moodId);
  const recommendations = useRecommendations({
    strengths: assessmentLite.strengths,
    iceberg: assessmentLite.iceberg,
    abc: currentSlotState?.showABC
      ? {
          A: currentSlotState.abc.antecedent,
          B: currentSlotState.abc.behavior,
          C: currentSlotState.abc.consequence,
        }
      : assessmentLite.aba,
    moodId: currentSlotMoodId ?? undefined,
  });

  const recordedCount = useMemo(() => scheduleSlots.filter((slot) => slot.isRecorded).length, [scheduleSlots]);
  const planUpdateData = useMemo(() => {
    const draftPlan = createDraftPlanV3();
    const activePlan = createActivePlanV2();
    const archivedPlan = createArchivedPlanV1();
    return {
      draftPlan,
      history: [activePlan, archivedPlan],
      activeSince: activePlan.updatedAt,
    };
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, value: TabValue) => {
    setTab(value);
  };

  const handleMoodSelect = (slotId: string, moodId: MoodId) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        moodId,
        error: null,
      },
    }));
  };

  const handleMoodClear = (slotId: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        moodId: null,
        error: null,
      },
    }));
  };

  const handleAssessmentLiteChange = (next: AssessmentLite) => {
    setAssessmentLite(sanitizeAssessmentLite(next));
  };

  const handleNoteChange = (slotId: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        note: value,
      },
    }));
  };

  const handleToggleABC = (slotId: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        showABC: !prev[slotId].showABC,
      },
    }));
  };

  const handleABCSelect = (slotId: string, key: keyof ABCSelection, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        abc: {
          ...prev[slotId].abc,
          [key]: value,
        },
      },
    }));
  };

  const handleRecord = (slot: ScheduleSlot) => {
    const currentState = formState[slot.id];
    const normalizedMoodId = coerceMoodId(currentState?.moodId);

    if (!normalizedMoodId) {
      setFormState((prev) => ({
        ...prev,
        [slot.id]: {
          ...prev[slot.id],
          error: '「本人の様子」を選択してください。',
        },
      }));
      setSnackbar({ open: true, message: '記録に必要な項目が未入力です。', severity: 'error' });
      return;
    }

    const abcIncluded = currentState.showABC && (currentState.abc.antecedent || currentState.abc.behavior || currentState.abc.consequence);
    const entry: TimelineEntry = {
      id: `${slot.id}-${Date.now()}`,
      time: slot.time,
      activity: slot.activity,
      moodId: normalizedMoodId,
      note: currentState.note.trim(),
      abc: abcIncluded ? currentState.abc : undefined,
      recordedAt: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };

    setTimeline((prev) => [entry, ...prev]);
    setScheduleSlots((prev) => prev.map((item) => (item.id === slot.id ? { ...item, isRecorded: true } : item)));
    setFormState((prev) => ({
      ...prev,
      [slot.id]: {
        moodId: null,
        note: '',
        showABC: prev[slot.id].showABC,
        abc: {
          antecedent: '',
          behavior: '',
          consequence: '',
        },
        error: null,
      },
    }));
    setSnackbar({ open: true, message: `${slot.time}「${slot.activity}」を記録しました。`, severity: 'success' });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SupportIcon color="primary" />
          <Typography variant="overline" color="text.secondary">
            強度行動障害支援ツール
          </Typography>
        </Stack>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {targetName} の支援手順記録
        </Typography>
        <Typography variant="body1" color="text.secondary">
          支援計画の確認と日々の記録をワンページで管理できます。記録済み {recordedCount}/{scheduleSlots.length}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            component={RouterLink}
            to={`/profiles/${userId}`}
            size="small"
            variant="outlined"
            aria-label="利用者プロファイル（フェイスシート）を開く"
          >
            利用者プロファイル
          </Button>
        </Box>
      </Paper>

      <Paper elevation={1}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          aria-label="支援計画と日々の記録タブ"
          variant="fullWidth"
        >
          <Tab
            value="plan"
            label="1日の中で気をつけること"
            icon={<FavoriteIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            value="records"
            label="日々の記録"
            icon={<ScheduleIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            value="createPlan"
            label="新規支援手順作成"
            icon={<AutoAwesomeIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            value="updatePlan"
            label="既存支援手順の編集"
            icon={<EditIcon fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>

        {tab === 'plan' && (
          <Box sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 2 }}>
            {supportSections.map((section) => (
              <Paper
                key={section.id}
                elevation={2}
                sx={{
                  borderLeft: 6,
                  borderColor: section.color,
                  p: 3,
                  backgroundColor: `${section.color}20`,
                }}
              >
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', fontWeight: 600, mb: 1 }}>
                  {section.icon}
                  {section.title}
                </Typography>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {section.description.map((item, index) => (
                    <li key={index}>
                      <Typography variant="body2" color="text.secondary">
                        {item}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </Paper>
            ))}
          </Box>
        )}

        {tab === 'createPlan' && (
          <Box sx={{ p: { xs: 0, md: 2 } }}>
            <BehaviorSupportPlanBuilder mode="create" />
          </Box>
        )}

        {tab === 'updatePlan' && (
          <Box sx={{ p: { xs: 0, md: 2 } }}>
            <BehaviorSupportPlanBuilder
              mode="update"
              initialPlan={planUpdateData.draftPlan}
              initialHistory={planUpdateData.history}
              initialActiveSince={planUpdateData.activeSince}
            />
          </Box>
        )}

        {tab === 'records' && (
          <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              時系列の記録リスト
            </Typography>
            <Stack spacing={2}>
              {scheduleSlots.map((slot) => {
                const state = formState[slot.id];
                const hasError = Boolean(state?.error);
                const detailsId = `${slot.id}-panel`;
                const summaryId = `${slot.id}-summary`;
                const slotMoodId = coerceMoodId(state?.moodId);

                return (
                  <Accordion key={slot.id} disableGutters expanded={expandedSlotId === slot.id} onChange={(_, exp) => setExpandedSlotId(exp ? slot.id : false)}>
                    <AccordionSummary
                      aria-controls={detailsId}
                      id={summaryId}
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        bgcolor: slot.isRecorded ? 'success.light' : 'background.default',
                        '& .MuiAccordionSummary-content': {
                          alignItems: 'center',
                          gap: 2,
                        },
                      }}
                    >
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>{slot.time}・{slot.activity}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {slot.isRecorded ? '記録済み' : '未記録'}
                        </Typography>
                      </Box>
                      {slot.isRecorded && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CheckCircleIcon fontSize="small" color="success" />
                          <Typography variant="body2" color="success.main">
                            記録済み
                          </Typography>
                        </Stack>
                      )}
                    </AccordionSummary>
                    <AccordionDetails id={detailsId} aria-labelledby={summaryId} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>本人のやること</Typography>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          {slot.selfTasks.map((task, index) => (
                            <li key={index}>
                              <Typography variant="body2" color="text.secondary">{task}</Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>支援者のやること</Typography>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          {slot.supporterTasks.map((task, index) => (
                            <li key={index}>
                              <Typography variant="body2" color="text.secondary">{task}</Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>

                      <Divider flexItem />

                      <Stack spacing={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>本人の様子 *</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {moodOptions.map((option) => (
                            <Chip
                              key={option.id}
                              label={option.label}
                              color={slotMoodId === option.id ? 'primary' : 'default'}
                              variant={slotMoodId === option.id ? 'filled' : 'outlined'}
                              onClick={() => handleMoodSelect(slot.id, option.id)}
                            />
                          ))}
                        </Stack>
                      </Stack>

                      <Stack spacing={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>特記事項</Typography>
                        <TextField
                          value={state?.note ?? ''}
                          multiline
                          minRows={3}
                          placeholder="気づいたことや共有したいことを記載してください"
                          onChange={(event) => handleNoteChange(slot.id, event.target.value)}
                        />
                      </Stack>

                      <Box>
                        <Button
                          size="small"
                          variant={state?.showABC ? 'outlined' : 'text'}
                          onClick={() => handleToggleABC(slot.id)}
                          aria-expanded={state?.showABC || false}
                        >
                          {state?.showABC ? 'ABC分析を隠す' : 'ABC分析を開く'}
                        </Button>
                        <Collapse in={Boolean(state?.showABC)}>
                          <Stack spacing={2} mt={2}>
                            {(['antecedent', 'behavior', 'consequence'] as (keyof ABCSelection)[]).map((key) => (
                              <Box key={key}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {key === 'antecedent' && 'A: 先行事象'}
                                  {key === 'behavior' && 'B: 行動'}
                                  {key === 'consequence' && 'C: 結果'}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                  {abcOptionMap[key].map((option) => (
                                    <Chip
                                      key={option}
                                      label={option}
                                      color={state?.abc[key] === option ? 'primary' : 'default'}
                                      variant={state?.abc[key] === option ? 'filled' : 'outlined'}
                                      onClick={() => handleABCSelect(slot.id, key, option)}
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </Collapse>
                      </Box>

                      {hasError && (
                        <Alert severity="warning" onClose={() => handleMoodClear(slot.id)}>
                          {state?.error}
                        </Alert>
                      )}

                      <Box display="flex" justifyContent="flex-end">
                        <Button
                          variant="contained"
                          onClick={() => handleRecord(slot)}
                        >
                          記録する
                        </Button>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Stack>

            {/* AssessmentFoldout panel (feature-flagged) */}
            {FEATURE_SUPPORT_CDS && (
              <AssessmentFoldout value={assessmentLite} onChange={handleAssessmentLiteChange} />
            )}

            <Divider />

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                記録タイムライン
              </Typography>
              {timeline.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  まだ記録はありません。上部の活動から記録を開始してください。
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {timeline.map((entry) => (
                    <Paper key={entry.id} variant="outlined" sx={{ p: 2.5 }}>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography sx={{ fontWeight: 600 }}>
                            {entry.time}・{entry.activity}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            記録: {entry.recordedAt}
                          </Typography>
                        </Stack>
                        <Typography variant="body2">本人の様子: {moodsById[entry.moodId]?.label ?? entry.moodId}</Typography>
                        {entry.note && (
                          <Typography variant="body2">
                            特記事項: {entry.note}
                          </Typography>
                        )}
                        {entry.abc && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>ABC分析</Typography>
                            <Typography variant="body2">A: {entry.abc.antecedent || '―'}</Typography>
                            <Typography variant="body2">B: {entry.abc.behavior || '―'}</Typography>
                            <Typography variant="body2">C: {entry.abc.consequence || '―'}</Typography>
                          </Box>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>

            {/* CDS Recommendations (nudge) panel (feature-flagged) */}
            {FEATURE_SUPPORT_CDS && (
              <Box role="region" aria-live="polite" aria-label="支援提案">
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  提案（ナッジ）
                </Typography>
                {recommendations.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 2, color: 'text.secondary' }}>
                    今の入力から提案はありません。評価（強み/氷山/ABA）を追加するか、ABCを入力してみてください。
                  </Paper>
                ) : (
                  <Stack spacing={1}>
                    {recommendations.map((recommendation) => {
                      const handleInsert = () => {
                        if (typeof expandedSlotId !== 'string') {
                          return;
                        }
                        const baseNote = formState[expandedSlotId]?.note ?? '';
                        const addition = recommendation.actions.map((line) => `・${line}`).join('\n');
                        handleNoteChange(
                          expandedSlotId,
                          baseNote ? `${baseNote}\n${addition}` : addition,
                        );
                      };

                      return (
                        <Paper key={recommendation.id} variant="outlined" sx={{ p: 2 }}>
                          <Stack spacing={0.5}>
                            <Typography sx={{ fontWeight: 600 }}>{recommendation.title}</Typography>
                            <Typography variant="body2" color="text.secondary">{recommendation.rationale}</Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                              {recommendation.actions.map((action, index) => (
                                <Chip key={index} label={action} size="small" />
                              ))}
                            </Stack>
                            <Box sx={{ textAlign: 'right', mt: 1 }}>
                              <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                <Button
                                  size="small"
                                  onClick={handleInsert}
                                  disabled={typeof expandedSlotId !== 'string'}
                                  aria-disabled={typeof expandedSlotId !== 'string'}
                                >
                                  この提案を特記事項に挿入
                                </Button>
                                {typeof expandedSlotId !== 'string' && (
                                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    挿入先の活動を開いてください
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            )}
          </Box>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default IndividualSupportManagementPage;
