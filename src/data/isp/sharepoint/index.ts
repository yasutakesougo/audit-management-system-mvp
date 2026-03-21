/**
 * ISP 三層モデル — Data Layer barrel export
 *
 * Repository ファクトリと共有ユーティリティを公開。
 *
 * @example
 * ```ts
 * import { createSharePointIspRepository } from '@/data/isp/sharepoint';
 * const repo = createSharePointIspRepository(spClient);
 * const isp = await repo.getById('sp-42');
 * ```
 */

export { createSharePointIspRepository, extractSpId } from './SharePointIspRepository';
export { createSharePointPlanningSheetRepository } from './SharePointPlanningSheetRepository';
export { createSharePointProcedureRecordRepository } from './SharePointProcedureRecordRepository';
export { createSharePointBehaviorMonitoringRepository } from './SharePointBehaviorMonitoringRepository';
export { createSharePointPlanningSheetReassessmentRepository } from './SharePointPlanningSheetReassessmentRepository';
