// Public API surface for monthly records

// Types (広めに公開)
export type {
	YearMonth,
	IsoDate,
	MonthlyRecordKey,
	MonthlyKpi,
	MonthlySummary,
	MonthlySummaryId,
	DailyRecord,
	MonthlyAggregationResult,
	MonthlyRecordFilter,
	MonthlyRecordSort,
	MonthlyRecordSortKey,
} from './types';

// Map/boundary helpers（境界で使うものだけ公開）
export {
	getCurrentYearMonth,
	parseYearMonth,
	parseIsoDate,
	fromSharePointFields,
	toSharePointFields,
	buildMonthlyRecordFilter,
	buildDailyRecordFilter,
	generateIdempotencyKey,
	generateMonthlySummaryId,
} from './map';

// Aggregation（集計ロジックの外部利用が必要なものだけ）
export {
	aggregateMonthlyKpi,
	aggregateMonthlySummary,
	aggregateMultipleUsers,
	extractRecordDateRange,
	calculateCompletionRate,
	getTotalDaysInMonth,
	getWorkingDaysInMonth,
	toYearMonth,
} from './aggregate';
