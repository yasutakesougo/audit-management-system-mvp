import * as fs from 'fs';
import * as path from 'path';

// Known replacements based on move script
const replacements: Record<string, string> = {
  // Root
  '@/features/daily/schema': '@/features/daily/domain/schema',
  '@/features/daily/repositoryFactory': '@/features/daily/repositories/repositoryFactory',
  
  // Folders
  '@/features/daily/infra/': '@/features/daily/repositories/sharepoint/',
  '@/features/daily/adapters/': '@/features/daily/repositories/adapters/',
  '@/features/daily/forms/': '@/features/daily/components/forms/',
  '@/features/daily/table/': '@/features/daily/components/table/',
  '@/features/daily/lists/': '@/features/daily/components/lists/',
  '@/features/daily/stores/': '@/features/daily/hooks/legacy-stores/',

  // Flat components
  '@/features/daily/components/FullScreenDailyDialogPage': '@/features/daily/components/pages/FullScreenDailyDialogPage',
  '@/features/daily/components/TbsRecentRecordsDialog': '@/features/daily/components/dialogs/TbsRecentRecordsDialog',
  '@/features/daily/components/TbsSnackbarFeedback': '@/features/daily/components/dialogs/TbsSnackbarFeedback',
  '@/features/daily/components/DailyPhaseHintBanner': '@/features/daily/components/sections/DailyPhaseHintBanner',
  '@/features/daily/components/HandoffSummaryBanner': '@/features/daily/components/sections/HandoffSummaryBanner',
  '@/features/daily/components/BehaviorPatternSuggestionPanel': '@/features/daily/components/sections/BehaviorPatternSuggestionPanel',
  '@/features/daily/components/BehaviorTagCrossInsightPanel': '@/features/daily/components/sections/BehaviorTagCrossInsightPanel',
  '@/features/daily/components/BehaviorTagInsightBar': '@/features/daily/components/sections/BehaviorTagInsightBar',
  '@/features/daily/components/TbsHeaderToolbar': '@/features/daily/components/sections/TbsHeaderToolbar',
  '@/features/daily/components/TbsUserFilterBar': '@/features/daily/components/sections/TbsUserFilterBar',
  '@/features/daily/components/TableDailyRecordHeader': '@/features/daily/components/sections/TableDailyRecordHeader',
  '@/features/daily/components/TableDailyRecordTable': '@/features/daily/components/sections/TableDailyRecordTable',
  '@/features/daily/components/TableDailyRecordUserPicker': '@/features/daily/components/sections/TableDailyRecordUserPicker',
  '@/features/daily/components/NextRecordHero': '@/features/daily/components/sections/NextRecordHero',
  '@/features/daily/components/BehaviorTagChips': '@/features/daily/components/sections/BehaviorTagChips',
  '@/features/daily/components/AppliedStrategiesBadges': '@/features/daily/components/sections/AppliedStrategiesBadges',
  '@/features/daily/components/RecordActionQueue': '@/features/daily/components/sections/RecordActionQueue',
  '@/features/daily/components/QuickTagArea': '@/features/daily/components/sections/QuickTagArea',
  '@/features/daily/components/MonitoringCountdown': '@/features/daily/components/sections/MonitoringCountdown',

  // Flat hooks
  '@/features/daily/hooks/useTableDailyRecordPersistence': '@/features/daily/hooks/mutations/useTableDailyRecordPersistence',
  '@/features/daily/hooks/useTableDailyRecordForm': '@/features/daily/hooks/view-models/useTableDailyRecordForm',
  '@/features/daily/hooks/useTimeBasedSupportPage': '@/features/daily/hooks/orchestrators/useTimeBasedSupportPage',
  '@/features/daily/hooks/useTableDailyRecordRouting': '@/features/daily/hooks/orchestrators/useTableDailyRecordRouting',
  '@/features/daily/hooks/useTableDailyRecordSelection': '@/features/daily/hooks/orchestrators/useTableDailyRecordSelection',
  '@/features/daily/hooks/useTableDailyRecordRowHandlers': '@/features/daily/hooks/orchestrators/useTableDailyRecordRowHandlers',
  '@/features/daily/hooks/useTableDailyRecordFiltering': '@/features/daily/hooks/orchestrators/useTableDailyRecordFiltering',
  
  // All other existing flat hooks -> hooks/legacy/
  '@/features/daily/hooks/useBehaviorData': '@/features/daily/hooks/legacy/useBehaviorData',
  '@/features/daily/hooks/useDailyRecordContextData': '@/features/daily/hooks/legacy/useDailyRecordContextData',
  '@/features/daily/hooks/useDailySupportUserFilter': '@/features/daily/hooks/legacy/useDailySupportUserFilter',
  '@/features/daily/hooks/useDefaultStrategies': '@/features/daily/hooks/legacy/useDefaultStrategies',
  '@/features/daily/hooks/useExecutionData': '@/features/daily/hooks/legacy/useExecutionData',
  '@/features/daily/hooks/useExecutionRecord': '@/features/daily/hooks/legacy/useExecutionRecord',
  '@/features/daily/hooks/useLastActivities': '@/features/daily/hooks/legacy/useLastActivities',
  '@/features/daily/hooks/useLinkedStrategies': '@/features/daily/hooks/legacy/useLinkedStrategies',
  '@/features/daily/hooks/useProcedureData': '@/features/daily/hooks/legacy/useProcedureData',
  '@/features/daily/hooks/useSupportWizard': '@/features/daily/hooks/legacy/useSupportWizard',
  '@/features/daily/hooks/useTodayAttendanceInfo': '@/features/daily/hooks/legacy/useTodayAttendanceInfo',

  // Flat domain
  '@/features/daily/domain/dailyTableMapper': '@/features/daily/domain/mappers/dailyTableMapper',
  '@/features/daily/domain/ispCandidateMapper': '@/features/daily/domain/mappers/ispCandidateMapper',
  '@/features/daily/domain/toBipOptions': '@/features/daily/domain/builders/toBipOptions',
  '@/features/daily/domain/rowInitialization': '@/features/daily/domain/builders/rowInitialization',
  '@/features/daily/domain/getScheduleKey': '@/features/daily/domain/builders/getScheduleKey',
  '@/features/daily/domain/dailyRecordLogic': '@/features/daily/domain/validation/dailyRecordLogic',
  '@/features/daily/domain/dailyRecordLogicLib': '@/features/daily/domain/validation/dailyRecordLogicLib',
  '@/features/daily/domain/deriveDefaultStrategies': '@/features/daily/domain/validation/deriveDefaultStrategies',
  '@/features/daily/domain/nextIncompleteRecord': '@/features/daily/domain/validation/nextIncompleteRecord',
  '@/features/daily/domain/behaviorTag': '@/features/daily/domain/behavior/behaviorTag',
  '@/features/daily/domain/behaviorTagCrossInsights': '@/features/daily/domain/behavior/behaviorTagCrossInsights',
  '@/features/daily/domain/behaviorTagInsights': '@/features/daily/domain/behavior/behaviorTagInsights',
  '@/features/daily/domain/behaviorPatternSuggestions': '@/features/daily/domain/behavior/behaviorPatternSuggestions',
  
  // All other domain -> domain/legacy/
  '@/features/daily/domain/adoptionMetrics': '@/features/daily/domain/legacy/adoptionMetrics',
  '@/features/daily/domain/classifyQueueRecords': '@/features/daily/domain/legacy/classifyQueueRecords',
  '@/features/daily/domain/generateDailyReport': '@/features/daily/domain/legacy/generateDailyReport',
  '@/features/daily/domain/resolveHeroRecord': '@/features/daily/domain/legacy/resolveHeroRecord',
  '@/features/daily/domain/suggestionAction': '@/features/daily/domain/legacy/suggestionAction',
  '@/features/daily/domain/executionRecordTypes': '@/features/daily/domain/legacy/executionRecordTypes',
  '@/features/daily/domain/BehaviorRepository': '@/features/daily/domain/legacy/BehaviorRepository',
  '@/features/daily/domain/DailyRecordRepository': '@/features/daily/domain/legacy/DailyRecordRepository',
  '@/features/daily/domain/ExecutionRecordRepository': '@/features/daily/domain/legacy/ExecutionRecordRepository',
  '@/features/daily/domain/ProcedureRepository': '@/features/daily/domain/legacy/ProcedureRepository',
};

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      getAllFiles(filepath, fileList);
    } else if (/\.(ts|tsx)$/.test(filepath)) {
      fileList.push(filepath);
    }
  }
  return fileList;
}

const allTsFiles = [
  ...getAllFiles(path.join(process.cwd(), 'src')),
  ...getAllFiles(path.join(process.cwd(), 'tests'))
];

let replacedFiles = 0;

for (const file of allTsFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;

  // Reverse sort keys by length to replace longer paths first
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const val = replacements[key];
    // Need to safely replace exactly the import path, not partials when unapplicable
    // Easiest is to regex replace globally
    // We match quotes around the import
    const re = new RegExp(`(['"\`])${key.replace(/\//g, '\\/')}`, 'g');
    content = content.replace(re, `$1${val}`);
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    replacedFiles++;
  }
}

console.log(`Replaced import paths in ${replacedFiles} files.`);
