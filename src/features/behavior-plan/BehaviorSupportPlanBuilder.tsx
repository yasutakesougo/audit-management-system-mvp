import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import AssessmentSummaryPanel, { type AssessmentInsight } from './AssessmentSummaryPanel';
import PlanEditor from './PlanEditor';
import VersionHistoryViewer from './VersionHistoryViewer';
import type { BehaviorSupportPlan, FlowSupportActivityTemplate } from '../../types/behaviorPlan';

const createInitialPlan = (): BehaviorSupportPlan => {
  const now = new Date().toISOString();
  return {
    planId: 'bsp-user001-v1',
    userId: 'user001',
    version: 1,
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    authorId: 'staff-abc123',
    assessmentSummary: {
      kodoScore: 22,
      functionalHypothesis: ['注目獲得', '感覚刺激'],
      assessmentNotes: '最新のアセスメントでは、通所開始時に高い覚醒状態が確認されています。',
    },
    proactiveStrategies: '',
    skillBuildingPlan: '',
    crisisResponseFlow: {},
    monitoringHistory: [],
    dailyActivities: [],
  };
};

export type BehaviorSupportPlanBuilderMode = 'create' | 'update';

interface BehaviorSupportPlanBuilderProps {
  initialPlan?: BehaviorSupportPlan;
  initialHistory?: BehaviorSupportPlan[];
  initialActiveSince?: string | null;
  mode?: BehaviorSupportPlanBuilderMode;
}

const sampleFbaInsights: AssessmentInsight[] = [
  {
    id: 'fba-2024-03-01',
    date: '2024-03-01',
    summary: '午前中の課題前に行動が増加。要求の伝え方が限定的なことが要因と推測。',
    source: 'ABC記録 #123',
  },
  {
    id: 'fba-2024-02-18',
    date: '2024-02-18',
    summary: '感覚刺激が不足した際に自傷行為が出現。早期に感覚入力を提供することで軽減。',
    source: 'FBAサマリー 2024Q1',
  },
];

const sampleSensoryProfile =
  '● 強い感覚入力（深圧、重量刺激）で落ち着きやすい。\n● 聴覚過敏の傾向があるため、ヘッドフォンの活用が有効。';

const sampleLifeHistory =
  '幼少期より音楽活動が好きで、リズム活動に参加すると安定する傾向がある。家族からの報告によると、朝食を十分に摂れない日は情緒が不安定になることが多い。';

const BehaviorSupportPlanBuilder: React.FC<BehaviorSupportPlanBuilderProps> = ({
  initialPlan,
  initialHistory = [],
  initialActiveSince = null,
  mode = 'create',
}) => {
  const [plan, setPlan] = useState<BehaviorSupportPlan>(() => initialPlan ?? createInitialPlan());
  const [versionHistory, setVersionHistory] = useState<BehaviorSupportPlan[]>(() => initialHistory);
  const [activeSince, setActiveSince] = useState<string | null>(initialActiveSince);
  const [monitoringNoteError, setMonitoringNoteError] = useState<string | null>(null);

  const isUpdateMode = mode === 'update';

  const nextMonitoringDue = useMemo(() => {
    const baseDate = plan.status === 'ACTIVE' ? (activeSince ?? plan.updatedAt) : activeSince;
    if (!baseDate) {
      return null;
    }
    return dayjs(baseDate).add(3, 'month').format('YYYY-MM-DD');
  }, [plan.status, activeSince, plan.updatedAt]);

  const handlePlanFieldChange = (updates: Partial<BehaviorSupportPlan>) => {
    setPlan((prev) => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleFunctionalHypothesisChange = (tags: string[]) => {
    setPlan((prev) => ({
      ...prev,
      assessmentSummary: {
        ...prev.assessmentSummary,
        functionalHypothesis: tags,
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleDailyActivitiesChange = (activities: FlowSupportActivityTemplate[]) => {
    setPlan((prev) => ({
      ...prev,
      dailyActivities: activities,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleCrisisFlowChange = (flow: Record<string, unknown>) => {
    setPlan((prev) => ({
      ...prev,
      crisisResponseFlow: flow,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleActivatePlan = () => {
    setPlan((prev) => ({
      ...prev,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    }));
    if (!activeSince) {
      setActiveSince(new Date().toISOString());
    }
  };

  const handleArchivePlan = () => {
    setPlan((prev) => ({
      ...prev,
      status: 'ARCHIVED',
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleCreateNewDraft = (monitoringSummary: string) => {
    if (!monitoringSummary.trim()) {
      setMonitoringNoteError('モニタリング所見は必須です。');
      return;
    }

    const now = new Date().toISOString();

    const snapshot: BehaviorSupportPlan = {
      ...plan,
      status: 'ARCHIVED',
      updatedAt: now,
    };

    const nextVersion = plan.version + 1;
    const newPlan: BehaviorSupportPlan = {
      ...plan,
      planId: `bsp-${plan.userId}-v${nextVersion}`,
      version: nextVersion,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
      monitoringHistory: [
        {
          date: now,
          summary: monitoringSummary.trim(),
          previousVersionId: plan.planId,
        },
        ...plan.monitoringHistory,
      ],
    };

    setVersionHistory((prevHistory) => [snapshot, ...prevHistory]);
    setPlan(newPlan);
    setMonitoringNoteError(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h5" fontWeight={700}>
                {isUpdateMode ? '強度行動障害支援計画の更新' : '強度行動障害支援計画ビルダー'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isUpdateMode
                  ? '最新のモニタリング所見を踏まえて計画を見直し、承認後に現場へ再展開します。'
                  : '中核的人材・実践研修修了者向けの計画立案ツールです。最新アセスメントに基づき、ABA/PBSの4本柱で支援計画を構築し、日次記録システムへ展開します。'}
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={2}>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  現在のバージョン
                </Typography>
                <Typography variant="h6">
                  v{plan.version} / {plan.status}
                </Typography>
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  行動関連項目スコア
                </Typography>
                <Typography variant="h6">{plan.assessmentSummary.kodoScore} 点</Typography>
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  次回モニタリング予定
                </Typography>
                <Typography variant="h6">
                  {nextMonitoringDue ?? '未設定'}
                </Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={2}>
              <Button
                variant="contained"
                color="primary"
                disabled={plan.status === 'ACTIVE'}
                onClick={handleActivatePlan}
              >
                計画をアクティブ化
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                disabled={plan.status === 'ARCHIVED'}
                onClick={handleArchivePlan}
              >
                計画をアーカイブ
              </Button>
            </Stack>
            {monitoringNoteError && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {monitoringNoteError}
              </Alert>
            )}
          </CardContent>
        </Card>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            alignItems: 'flex-start',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 2fr)' },
          }}
        >
          <Box>
            <AssessmentSummaryPanel
              userId={plan.userId}
              userName="田中　太郎"
              assessmentSummary={plan.assessmentSummary}
              insights={sampleFbaInsights}
              sensoryProfile={sampleSensoryProfile}
              lifeHistory={sampleLifeHistory}
            />
          </Box>
          <Box>
            <PlanEditor
              plan={plan}
              onFunctionalHypothesisChange={handleFunctionalHypothesisChange}
              onPlanFieldChange={handlePlanFieldChange}
              onDailyActivitiesChange={handleDailyActivitiesChange}
              onCrisisFlowChange={handleCrisisFlowChange}
              onCreateDraftFromActive={handleCreateNewDraft}
            />
          </Box>
        </Box>

        <Divider />

        <VersionHistoryViewer currentPlan={plan} archivedPlans={versionHistory} />
      </Stack>
    </Box>
  );
};

export default BehaviorSupportPlanBuilder;
