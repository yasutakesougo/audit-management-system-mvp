import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Box from '@mui/material/Box';
import { TESTIDS, tid } from '@/testids';
import { PhaseNextStepBanner } from '@/features/planning-sheet/components/PhaseNextStepBanner';
import { EditableOverviewSection } from '@/features/planning-sheet/components/EditableOverviewSection';
import { EditableIntakeSection } from '@/features/planning-sheet/components/EditableIntakeSection';
import { EditableAssessmentSection } from '@/features/planning-sheet/components/EditableAssessmentSection';
import { EditablePlanningDesignSection } from '@/features/planning-sheet/components/EditablePlanningDesignSection';
import { EditableRegulatorySection } from '@/features/planning-sheet/components/EditableRegulatorySection';
import {
  AssessmentSection,
  IntakeSection,
  PlanningDesignSection,
} from '@/features/planning-sheet/components/ReadOnlySections';
import { TrendOverviewBar } from '@/features/planning-sheet/components/StrategyTrendIndicator';
import { EvidencePatternSummaryCard } from '@/features/planning-sheet/components/EvidencePatternSummaryCard';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import { type WorkflowPhase } from '@/app/services/bridgeProxy';
import type { EvidenceLinkMap, EvidenceLinkType } from '@/domain/isp/evidenceLink';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import type { StrategyUsageSummary, StrategyUsageTrendResult } from '@/domain/isp/aggregateStrategyUsage';
import type { TrendDays } from '@/features/planning-sheet/hooks/useStrategyUsageTrend';
import { ReadOnlyOverview, ReadOnlyRegulatory } from '../ReadOnlySections';
import { TAB_SECTIONS, TabPanel, type SheetTabKey } from '../types';

type PlanningTabsSectionProps = {
  activeTab: SheetTabKey;
  onTabChange: (tab: SheetTabKey) => void;
  currentPhase: WorkflowPhase | null;
  hasPendingPlanUpdate?: boolean;
  hasOverduePlanUpdate?: boolean;
  onBannerNavigate: (href: string) => void;
  isEditing: boolean;
  form: UsePlanningSheetFormReturn;
  allProvenanceEntries: ProvenanceEntry[];
  sheet: SupportPlanningSheet;
  evidenceLinks: EvidenceLinkMap;
  abcRecords: AbcRecord[];
  pdcaItems: IcebergPdcaItem[];
  onEvidenceLinksChange: (updated: EvidenceLinkMap) => void;
  onEvidenceClick: (type: EvidenceLinkType, referenceId: string) => void;
  strategyUsage: StrategyUsageSummary | null;
  strategyUsageLoading: boolean;
  trendResult: StrategyUsageTrendResult | null;
  trendDays: TrendDays;
  onTrendDaysChange: (days: TrendDays) => void;
  trendLoading: boolean;
};

export function PlanningTabsSection({
  activeTab,
  onTabChange,
  currentPhase,
  hasPendingPlanUpdate = false,
  hasOverduePlanUpdate = false,
  onBannerNavigate,
  isEditing,
  form,
  allProvenanceEntries,
  sheet,
  evidenceLinks,
  abcRecords,
  pdcaItems,
  onEvidenceLinksChange,
  onEvidenceClick,
  strategyUsage,
  strategyUsageLoading,
  trendResult,
  trendDays,
  onTrendDaysChange,
  trendLoading,
}: PlanningTabsSectionProps) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 } }}>
      <Tabs
        value={activeTab}
        onChange={(_event, nextTab) => onTabChange(nextTab as SheetTabKey)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="支援計画シートセクション切り替え"
        {...tid(TESTIDS['planning-sheet-tabs'])}
      >
        {TAB_SECTIONS.map((tab) => (
          <Tab
            key={tab.key}
            value={tab.key}
            label={tab.label}
            id={`planning-sheet-tab-${tab.key}`}
            aria-controls={`planning-sheet-tabpanel-${tab.key}`}
          />
        ))}
      </Tabs>

      <TabPanel current={activeTab} value="overview">
        {currentPhase && (
          <PhaseNextStepBanner
            phase={currentPhase}
            context="overview"
            planningSheetId={sheet.id}
            hasPendingPlanUpdate={hasPendingPlanUpdate}
            hasOverduePlanUpdate={hasOverduePlanUpdate}
            onNavigate={onBannerNavigate}
          />
        )}
        {isEditing ? (
          <EditableOverviewSection
            values={form.values}
            setFieldValue={form.setFieldValue}
            errors={form.validationErrors}
            provenanceEntries={allProvenanceEntries}
          />
        ) : (
          <ReadOnlyOverview sheet={sheet} />
        )}
      </TabPanel>

      <TabPanel current={activeTab} value="intake">
        {isEditing ? (
          <EditableIntakeSection
            intake={form.intake}
            onChange={form.setIntake}
            provenanceEntries={allProvenanceEntries}
          />
        ) : (
          <IntakeSection sheet={sheet} />
        )}
      </TabPanel>

      <TabPanel current={activeTab} value="assessment">
        {isEditing ? (
          <EditableAssessmentSection
            assessment={form.assessment}
            onChange={form.setAssessment}
          />
        ) : (
          <AssessmentSection sheet={sheet} />
        )}
      </TabPanel>

      <TabPanel current={activeTab} value="planning">
        <EvidencePatternSummaryCard
          evidenceLinks={evidenceLinks}
          abcRecords={abcRecords}
          defaultExpanded={!isEditing}
        />
        <Box sx={{ mt: 2 }}>
          <TrendOverviewBar
            trendResult={trendResult}
            days={trendDays}
            onDaysChange={onTrendDaysChange}
            loading={trendLoading}
          />
          {currentPhase && (
            <PhaseNextStepBanner
              phase={currentPhase}
              context="planning"
              userId={sheet.userId}
              planningSheetId={sheet.id}
              hasPendingPlanUpdate={hasPendingPlanUpdate}
              hasOverduePlanUpdate={hasOverduePlanUpdate}
              onNavigate={onBannerNavigate}
            />
          )}
          {isEditing ? (
            <EditablePlanningDesignSection
              planning={form.planning}
              onChange={form.setPlanning}
              abcRecords={abcRecords}
              pdcaItems={pdcaItems}
              evidenceLinks={evidenceLinks}
              onEvidenceLinksChange={onEvidenceLinksChange}
              onEvidenceClick={onEvidenceClick}
              strategyUsage={strategyUsage}
              strategyUsageLoading={strategyUsageLoading}
              trendResult={trendResult}
            />
          ) : (
            <PlanningDesignSection
              sheet={sheet}
              evidenceLinks={evidenceLinks}
              onEvidenceClick={onEvidenceClick}
              strategyUsage={strategyUsage}
              strategyUsageLoading={strategyUsageLoading}
              trendResult={trendResult}
            />
          )}
        </Box>
      </TabPanel>

      <TabPanel current={activeTab} value="regulatory">
        {isEditing ? (
          <EditableRegulatorySection
            values={form.values}
            sheet={sheet}
            setFieldValue={form.setFieldValue}
          />
        ) : (
          <ReadOnlyRegulatory sheet={sheet} />
        )}
      </TabPanel>
    </Paper>
  );
}
