import {
  activatePlanningSheetVersion,
  archivePlanningSheetVersion,
  createRevisionDraft,
  sortByVersionDescFull,
  type ActivationParams,
  type ArchiveParams,
  type RevisionDraftParams,
} from '@/domain/isp/planningSheetVersion';
import type {
  PlanningSheetCreateInput,
  PlanningSheetRepository,
  PlanningSheetUpdateInput,
} from '@/domain/isp/port';
import type { SupportPlanningSheet } from '@/domain/isp/schema';

function toCreateInput(sheet: SupportPlanningSheet): PlanningSheetCreateInput {
  return {
    userId: sheet.userId,
    ispId: sheet.ispId,
    title: sheet.title,
    targetScene: sheet.targetScene,
    targetDomain: sheet.targetDomain,
    observationFacts: sheet.observationFacts,
    collectedInformation: sheet.collectedInformation,
    interpretationHypothesis: sheet.interpretationHypothesis,
    supportIssues: sheet.supportIssues,
    supportPolicy: sheet.supportPolicy,
    environmentalAdjustments: sheet.environmentalAdjustments,
    concreteApproaches: sheet.concreteApproaches,
    appliedFrom: sheet.appliedFrom ?? undefined,
    nextReviewAt: sheet.nextReviewAt ?? undefined,
    supportStartDate: sheet.supportStartDate ?? undefined,
    monitoringCycleDays: sheet.monitoringCycleDays,
    authoredByStaffId: sheet.authoredByStaffId,
    authoredByQualification: sheet.authoredByQualification,
    authoredAt: sheet.authoredAt ?? undefined,
    applicableServiceType: sheet.applicableServiceType,
    applicableAddOnTypes: sheet.applicableAddOnTypes,
    deliveredToUserAt: sheet.deliveredToUserAt ?? undefined,
    reviewedAt: sheet.reviewedAt ?? undefined,
    hasMedicalCoordination: sheet.hasMedicalCoordination,
    hasEducationCoordination: sheet.hasEducationCoordination,
    status: sheet.status,
    version: sheet.version,
    isCurrent: sheet.isCurrent,
    regulatoryBasisSnapshot: sheet.regulatoryBasisSnapshot,
    intake: sheet.intake,
    assessment: sheet.assessment,
    planning: sheet.planning,
  };
}

function toUpdateInput(sheet: SupportPlanningSheet): PlanningSheetUpdateInput {
  return {
    title: sheet.title,
    targetScene: sheet.targetScene,
    targetDomain: sheet.targetDomain,
    observationFacts: sheet.observationFacts,
    collectedInformation: sheet.collectedInformation,
    interpretationHypothesis: sheet.interpretationHypothesis,
    supportIssues: sheet.supportIssues,
    supportPolicy: sheet.supportPolicy,
    environmentalAdjustments: sheet.environmentalAdjustments,
    concreteApproaches: sheet.concreteApproaches,
    appliedFrom: sheet.appliedFrom ?? undefined,
    nextReviewAt: sheet.nextReviewAt ?? undefined,
    supportStartDate: sheet.supportStartDate ?? undefined,
    monitoringCycleDays: sheet.monitoringCycleDays,
    authoredByStaffId: sheet.authoredByStaffId,
    authoredByQualification: sheet.authoredByQualification,
    authoredAt: sheet.authoredAt ?? undefined,
    applicableServiceType: sheet.applicableServiceType,
    applicableAddOnTypes: sheet.applicableAddOnTypes,
    deliveredToUserAt: sheet.deliveredToUserAt ?? undefined,
    reviewedAt: sheet.reviewedAt ?? undefined,
    hasMedicalCoordination: sheet.hasMedicalCoordination,
    hasEducationCoordination: sheet.hasEducationCoordination,
    status: sheet.status,
    version: sheet.version,
    isCurrent: sheet.isCurrent,
    regulatoryBasisSnapshot: sheet.regulatoryBasisSnapshot,
    intake: sheet.intake,
    assessment: sheet.assessment,
    planning: sheet.planning,
  };
}

async function resolveTargetAndSeries(
  repo: PlanningSheetRepository,
  targetSheetId: string,
): Promise<{ target: SupportPlanningSheet; series: SupportPlanningSheet[] }> {
  const target = await repo.getById(targetSheetId);
  if (!target) {
    throw new Error(`Planning sheet not found: ${targetSheetId}`);
  }

  const series = await repo.listBySeries(target.userId, target.ispId);
  if (series.length === 0) {
    throw new Error(`Planning sheet series not found: ${target.userId}/${target.ispId}`);
  }

  return { target, series: sortByVersionDescFull(series) };
}

export async function listPlanningSheetSeries(
  repo: PlanningSheetRepository,
  userId: string,
  ispId: string,
): Promise<SupportPlanningSheet[]> {
  const series = await repo.listBySeries(userId, ispId);
  return sortByVersionDescFull(series);
}

export async function getCurrentOrLatestPlanningSheet(
  repo: PlanningSheetRepository,
  userId: string,
): Promise<SupportPlanningSheet | null> {
  const currentItems = await repo.listCurrentByUser(userId);
  const currentId = currentItems[0]?.id;
  if (currentId) {
    return repo.getById(currentId);
  }

  const allItems = await repo.listByUser(userId);
  const latestId = allItems[0]?.id;
  if (!latestId) return null;
  return repo.getById(latestId);
}

export async function createPlanningSheetRevision(
  repo: PlanningSheetRepository,
  currentSheetId: string,
  params: RevisionDraftParams,
): Promise<SupportPlanningSheet> {
  const current = await repo.getById(currentSheetId);
  if (!current) {
    throw new Error(`Planning sheet not found: ${currentSheetId}`);
  }

  const draft = createRevisionDraft(current, params);
  return repo.create(toCreateInput(draft));
}

export async function activatePlanningSheetVersionInRepository(
  repo: PlanningSheetRepository,
  targetSheetId: string,
  params: ActivationParams,
): Promise<SupportPlanningSheet[]> {
  const { target, series } = await resolveTargetAndSeries(repo, targetSheetId);
  const updatedSeries = activatePlanningSheetVersion(series, targetSheetId, params);

  const updates = updatedSeries.map(async (sheet) => {
    const before = series.find((candidate) => candidate.id === sheet.id);
    if (!before) return;
    if (
      before.status === sheet.status &&
      before.isCurrent === sheet.isCurrent &&
      before.appliedFrom === sheet.appliedFrom &&
      before.updatedBy === sheet.updatedBy
    ) {
      return;
    }
    await repo.update(sheet.id, toUpdateInput(sheet));
  });

  await Promise.all(updates);
  const persisted = await repo.listBySeries(target.userId, target.ispId);
  return sortByVersionDescFull(persisted);
}

export async function archivePlanningSheetVersionInRepository(
  repo: PlanningSheetRepository,
  targetSheetId: string,
  params: ArchiveParams,
): Promise<SupportPlanningSheet> {
  const target = await repo.getById(targetSheetId);
  if (!target) {
    throw new Error(`Planning sheet not found: ${targetSheetId}`);
  }

  const archived = archivePlanningSheetVersion(target, params);
  await repo.update(targetSheetId, toUpdateInput(archived));

  const persisted = await repo.getById(targetSheetId);
  return persisted ?? archived;
}
