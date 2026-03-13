// ---------------------------------------------------------------------------
// ComplianceDashboard — 適正化運用ダッシュボード
//
// P0-3: 委員会開催状況・指針整備状況・研修実施状況を一覧表示。
// 運営基準の適正化三要素（委員会・指針・研修）の充足状況を可視化する。
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import GroupsIcon from '@mui/icons-material/Groups';
import DescriptionIcon from '@mui/icons-material/Description';
import SchoolIcon from '@mui/icons-material/School';
import ShieldIcon from '@mui/icons-material/Shield';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import {
  type CommitteeMeetingRecord,
  type CommitteeSummary,
  computeCommitteeSummary,
} from '@/domain/safety/complianceCommittee';
import {
  type GuidelineVersion,
  type GuidelineSummary,
  computeGuidelineSummary,
  REQUIRED_ITEM_LABELS,
  type GuidelineRequiredItems,
} from '@/domain/safety/guidelineVersion';
import {
  type TrainingRecord,
  type TrainingSummary,
  computeTrainingSummary,
} from '@/domain/safety/trainingRecord';
import {
  localCommitteeRepository,
  localGuidelineRepository,
  localTrainingRepository,
} from '@/infra/localStorage/localComplianceRepository';
import { TESTIDS } from '@/testids';

// ---------------------------------------------------------------------------
// Status Badge Helper
// ---------------------------------------------------------------------------

type ComplianceLevel = 'good' | 'warning' | 'critical';

function getComplianceLevel(met: boolean, deadline?: string | null): ComplianceLevel {
  if (met) return 'good';
  if (deadline) {
    const daysUntil = Math.ceil(
      (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntil < 30) return 'critical';
  }
  return 'warning';
}

const LEVEL_COLORS: Record<ComplianceLevel, string> = {
  good: '#2e7d32',
  warning: '#ed6c02',
  critical: '#d32f2f',
};

const LEVEL_LABELS: Record<ComplianceLevel, string> = {
  good: '基準充足',
  warning: '要注意',
  critical: '要対応',
};

// ---------------------------------------------------------------------------
// Overview Card
// ---------------------------------------------------------------------------

interface OverviewCardProps {
  icon: React.ReactNode;
  title: string;
  level: ComplianceLevel;
  mainValue: string;
  subText: string;
  testId: string;
}

const OverviewCard: React.FC<OverviewCardProps> = ({
  icon,
  title,
  level,
  mainValue,
  subText,
  testId,
}) => (
  <Card
    variant="outlined"
    data-testid={testId}
    sx={{
      borderLeft: `4px solid ${LEVEL_COLORS[level]}`,
      transition: 'box-shadow 0.2s ease-in-out',
      '&:hover': { boxShadow: 3 },
    }}
  >
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Box sx={{ color: LEVEL_COLORS[level], display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        <Chip
          label={LEVEL_LABELS[level]}
          size="small"
          sx={{
            ml: 'auto',
            bgcolor: `${LEVEL_COLORS[level]}15`,
            color: LEVEL_COLORS[level],
            fontWeight: 700,
            fontSize: '0.7rem',
          }}
        />
      </Stack>
      <Typography variant="h4" fontWeight={800} color={LEVEL_COLORS[level]}>
        {mainValue}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {subText}
      </Typography>
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------------------
// Committee Tab
// ---------------------------------------------------------------------------

interface CommitteeTabProps {
  records: CommitteeMeetingRecord[];
  summary: CommitteeSummary;
}

const CommitteeTab: React.FC<CommitteeTabProps> = ({ records, summary }) => {
  const sorted = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime(),
      ),
    [records],
  );

  return (
    <Box data-testid={TESTIDS['compliance-committee-tab']}>
      {/* KPI Row */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            今年度の開催回数
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.currentFiscalYearMeetings} / 4回
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            身体拘束検討率
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.restraintDiscussionRate}%
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            次回推奨日
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.nextRecommendedDate ?? '—'}
          </Typography>
        </Card>
      </Box>

      {/* Records Table */}
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        開催履歴
      </Typography>
      {sorted.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          委員会記録はまだありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>開催日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>種別</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>議題</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>拘束検討</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>参加者数</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.meetingDate}</TableCell>
                  <TableCell>
                    <Chip label={r.committeeType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {r.agenda || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.restraintDiscussed ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : (
                      <CancelIcon fontSize="small" color="disabled" />
                    )}
                  </TableCell>
                  <TableCell>{r.attendees.length}名</TableCell>
                  <TableCell>
                    <Chip
                      label={r.status === 'finalized' ? '確定' : '下書き'}
                      size="small"
                      color={r.status === 'finalized' ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Guideline Tab
// ---------------------------------------------------------------------------

interface GuidelineTabProps {
  versions: GuidelineVersion[];
  summary: GuidelineSummary;
}

const GuidelineTab: React.FC<GuidelineTabProps> = ({ versions, summary }) => {
  const currentVersion = useMemo(
    () => versions.find((v) => v.status === 'active'),
    [versions],
  );

  return (
    <Box data-testid={TESTIDS['compliance-guideline-tab']}>
      {/* Current Version Card */}
      <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <DescriptionIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>
            現行版
          </Typography>
          {summary.currentVersion && (
            <Chip
              label={`v${summary.currentVersion}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Stack>

        {!currentVersion ? (
          <Typography color="text.secondary">
            指針が登録されていません。指針の策定を行ってください。
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              施行日: {summary.currentEffectiveDate}
            </Typography>

            {/* Required Items Progress */}
            <Box sx={{ mt: 2, mb: 1 }}>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  必須項目の充足状況
                </Typography>
                <Typography variant="body2" fontWeight={700} color={summary.allItemsFulfilled ? 'success.main' : 'warning.main'}>
                  {summary.currentFulfilledItems} / 7 ({summary.currentFulfillmentRate}%)
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={summary.currentFulfillmentRate}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: summary.allItemsFulfilled ? 'success.main' : 'warning.main',
                  },
                }}
              />
            </Box>

            {/* Required Items Checklist */}
            <List dense sx={{ mt: 1 }}>
              {(Object.entries(currentVersion.requiredItems) as [keyof GuidelineRequiredItems, boolean][]).map(
                ([key, fulfilled]) => (
                  <ListItem key={key} disablePadding sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {fulfilled ? (
                        <CheckCircleIcon fontSize="small" color="success" />
                      ) : (
                        <CancelIcon fontSize="small" color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={REQUIRED_ITEM_LABELS[key]}
                      primaryTypographyProps={{
                        variant: 'body2',
                        color: fulfilled ? 'text.primary' : 'error.main',
                        fontWeight: fulfilled ? 400 : 600,
                      }}
                    />
                  </ListItem>
                ),
              )}
            </List>
          </>
        )}
      </Card>

      {/* Version History */}
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        バージョン履歴
      </Typography>
      {versions.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          指針のバージョン履歴はまだありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>バージョン</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>施行日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>変更種別</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>必須項目</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      v{v.version}
                    </Typography>
                  </TableCell>
                  <TableCell>{v.effectiveDate}</TableCell>
                  <TableCell>
                    <Chip label={v.changeType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {Object.values(v.requiredItems).filter(Boolean).length} / 7
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        v.status === 'active'
                          ? '現行'
                          : v.status === 'archived'
                            ? '旧版'
                            : '下書き'
                      }
                      size="small"
                      color={
                        v.status === 'active'
                          ? 'success'
                          : v.status === 'archived'
                            ? 'default'
                            : 'warning'
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Training Tab
// ---------------------------------------------------------------------------

interface TrainingTabProps {
  records: TrainingRecord[];
  summary: TrainingSummary;
}

const TrainingTab: React.FC<TrainingTabProps> = ({ records, summary }) => {
  const sorted = useMemo(
    () =>
      [...records]
        .filter((r) => r.status !== 'cancelled')
        .sort(
          (a, b) => new Date(b.trainingDate).getTime() - new Date(a.trainingDate).getTime(),
        ),
    [records],
  );

  return (
    <Box data-testid={TESTIDS['compliance-training-tab']}>
      {/* KPI Row */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
        }}
      >
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            今年度の研修回数
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.currentFiscalYearTrainings} / 2回
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            平均参加率
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.averageAttendanceRate}%
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            延べ参加人数
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.totalParticipantCount}名
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            次回推奨日
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {summary.nextRecommendedDate ?? '—'}
          </Typography>
        </Card>
      </Box>

      {/* Records Table */}
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        研修履歴
      </Typography>
      {sorted.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          研修記録はまだありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>研修日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>研修名</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>種別</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>形式</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>時間</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>参加者</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.trainingDate}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {r.title || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={r.trainingType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{r.format}</Typography>
                  </TableCell>
                  <TableCell>{r.durationMinutes}分</TableCell>
                  <TableCell>
                    {r.participants.filter((p) => p.attended).length} / {r.participants.length}名
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.status === 'completed' ? '完了' : '予定'}
                      size="small"
                      color={r.status === 'completed' ? 'success' : 'info'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

const ComplianceDashboard: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [committeeRecords, setCommitteeRecords] = useState<CommitteeMeetingRecord[]>([]);
  const [guidelineVersions, setGuidelineVersions] = useState<GuidelineVersion[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [committees, guidelines, trainings] = await Promise.all([
        localCommitteeRepository.getAll(),
        localGuidelineRepository.getAll(),
        localTrainingRepository.getAll(),
      ]);
      setCommitteeRecords(committees);
      setGuidelineVersions(guidelines);
      setTrainingRecords(trainings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const committeeSummary = useMemo(
    () => computeCommitteeSummary(committeeRecords),
    [committeeRecords],
  );
  const guidelineSummary = useMemo(
    () => computeGuidelineSummary(guidelineVersions),
    [guidelineVersions],
  );
  const trainingSummary = useMemo(
    () => computeTrainingSummary(trainingRecords),
    [trainingRecords],
  );

  // Compliance levels
  const committeeLevel = getComplianceLevel(
    committeeSummary.meetsQuarterlyRequirement,
    committeeSummary.nextRecommendedDate,
  );
  const guidelineLevel = getComplianceLevel(
    guidelineSummary.allItemsFulfilled,
  );
  const trainingLevel = getComplianceLevel(
    trainingSummary.meetsBiannualRequirement,
    trainingSummary.nextRecommendedDate,
  );

  // Overall level
  const overallLevel: ComplianceLevel =
    committeeLevel === 'critical' || guidelineLevel === 'critical' || trainingLevel === 'critical'
      ? 'critical'
      : committeeLevel === 'warning' || guidelineLevel === 'warning' || trainingLevel === 'warning'
        ? 'warning'
        : 'good';

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container
      maxWidth="xl"
      sx={{ py: 3, minHeight: '100vh' }}
      data-testid={TESTIDS['compliance-dashboard-page']}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <ShieldIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={800}>
            適正化運用ダッシュボード
          </Typography>
          <Typography variant="body2" color="text.secondary">
            身体拘束等適正化に係る委員会・指針・研修の運用状況
          </Typography>
        </Box>
        <Chip
          icon={overallLevel === 'good' ? <TrendingUpIcon /> : <WarningAmberIcon />}
          label={LEVEL_LABELS[overallLevel]}
          sx={{
            ml: 'auto',
            bgcolor: `${LEVEL_COLORS[overallLevel]}15`,
            color: LEVEL_COLORS[overallLevel],
            fontWeight: 700,
          }}
        />
      </Box>

      {/* Overview Cards */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        <OverviewCard
          icon={<GroupsIcon fontSize="large" />}
          title="適正化委員会"
          level={committeeLevel}
          mainValue={`${committeeSummary.currentFiscalYearMeetings} / 4回`}
          subText={
            committeeSummary.lastMeetingDate
              ? `最終開催: ${committeeSummary.lastMeetingDate}`
              : '開催記録なし'
          }
          testId={TESTIDS['compliance-overview-committee']}
        />
        <OverviewCard
          icon={<DescriptionIcon fontSize="large" />}
          title="適正化指針"
          level={guidelineLevel}
          mainValue={`${guidelineSummary.currentFulfilledItems} / 7項目`}
          subText={
            guidelineSummary.currentVersion
              ? `現行版 v${guidelineSummary.currentVersion}`
              : '指針未策定'
          }
          testId={TESTIDS['compliance-overview-guideline']}
        />
        <OverviewCard
          icon={<SchoolIcon fontSize="large" />}
          title="職員研修"
          level={trainingLevel}
          mainValue={`${trainingSummary.currentFiscalYearTrainings} / 2回`}
          subText={
            trainingSummary.lastTrainingDate
              ? `最終研修: ${trainingSummary.lastTrainingDate}`
              : '研修記録なし'
          }
          testId={TESTIDS['compliance-overview-training']}
        />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Tab Navigation */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2 }}
        data-testid={TESTIDS['compliance-dashboard-tabs']}
      >
        <Tab
          icon={<GroupsIcon />}
          iconPosition="start"
          label="委員会"
          sx={{ fontWeight: 700 }}
        />
        <Tab
          icon={<DescriptionIcon />}
          iconPosition="start"
          label="指針"
          sx={{ fontWeight: 700 }}
        />
        <Tab
          icon={<SchoolIcon />}
          iconPosition="start"
          label="研修"
          sx={{ fontWeight: 700 }}
        />
      </Tabs>

      {/* Tab Content */}
      {tab === 0 && (
        <CommitteeTab records={committeeRecords} summary={committeeSummary} />
      )}
      {tab === 1 && (
        <GuidelineTab versions={guidelineVersions} summary={guidelineSummary} />
      )}
      {tab === 2 && (
        <TrainingTab records={trainingRecords} summary={trainingSummary} />
      )}
    </Container>
  );
};

export default ComplianceDashboard;
