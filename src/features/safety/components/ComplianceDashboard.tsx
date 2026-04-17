// ---------------------------------------------------------------------------
// ComplianceDashboard — 適正化運用ダッシュボード
//
// P0-3: 委員会開催状況・指針整備状況・研修実施状況を一覧表示。
// 運営基準の適正化三要素（委員会・指針・研修）の充足状況を可視化する。
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Fab from '@mui/material/Fab';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import SchoolIcon from '@mui/icons-material/School';
import ShieldIcon from '@mui/icons-material/Shield';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import type { CommitteeMeetingRecord } from '@/domain/safety/complianceCommittee';
import { computeCommitteeSummary } from '@/domain/safety/complianceCommittee';
import type { GuidelineVersion } from '@/domain/safety/guidelineVersion';
import { computeGuidelineSummary } from '@/domain/safety/guidelineVersion';
import type { TrainingRecord } from '@/domain/safety/trainingRecord';
import { computeTrainingSummary } from '@/domain/safety/trainingRecord';
import {
  localCommitteeRepository,
  localGuidelineRepository,
  localTrainingRepository,
} from '@/infra/localStorage/localComplianceRepository';
import { TESTIDS } from '@/testids';
import { CommitteeMeetingDialog } from './CommitteeMeetingDialog';
import { GuidelineVersionDialog } from './GuidelineVersionDialog';
import { TrainingRecordDialog } from './TrainingRecordDialog';
import { formatDateYmd } from '@/lib/dateFormat';

// ── Local (split) ──
import type { ComplianceLevel } from './compliance-dashboard/types';
import { getComplianceLevel, LEVEL_COLORS, LEVEL_LABELS, OverviewCard } from './compliance-dashboard/types';
import { CommitteeTab } from './compliance-dashboard/CommitteeTab';
import { GuidelineTab } from './compliance-dashboard/GuidelineTab';
import { TrainingTab } from './compliance-dashboard/TrainingTab';

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

const ComplianceDashboard: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [committeeRecords, setCommitteeRecords] = useState<CommitteeMeetingRecord[]>([]);
  const [guidelineVersions, setGuidelineVersions] = useState<GuidelineVersion[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [committeeDialogOpen, setCommitteeDialogOpen] = useState(false);
  const [guidelineDialogOpen, setGuidelineDialogOpen] = useState(false);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);

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
              ? `最終開催: ${formatDateYmd(committeeSummary.lastMeetingDate)}`
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
              ? `最終研修: ${formatDateYmd(trainingSummary.lastTrainingDate)}`
              : '研修記録なし'
          }
          testId={TESTIDS['compliance-overview-training']}
        />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Tab Navigation + Add Button */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ flex: 1 }}
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
        <Tooltip title={tab === 0 ? '委員会記録を追加' : tab === 1 ? '指針版を追加' : '研修記録を追加'}>
          <Fab
            color="primary"
            size="medium"
            onClick={() => {
              if (tab === 0) setCommitteeDialogOpen(true);
              else if (tab === 1) setGuidelineDialogOpen(true);
              else setTrainingDialogOpen(true);
            }}
            data-testid="compliance-add-button"
          >
            <AddIcon />
          </Fab>
        </Tooltip>
      </Stack>

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

      {/* Dialogs */}
      <CommitteeMeetingDialog
        open={committeeDialogOpen}
        onClose={() => setCommitteeDialogOpen(false)}
        onSaved={() => void loadData()}
      />
      <GuidelineVersionDialog
        open={guidelineDialogOpen}
        onClose={() => setGuidelineDialogOpen(false)}
        onSaved={() => void loadData()}
      />
      <TrainingRecordDialog
        open={trainingDialogOpen}
        onClose={() => setTrainingDialogOpen(false)}
        onSaved={() => void loadData()}
      />
    </Container>
  );
};

export default ComplianceDashboard;
