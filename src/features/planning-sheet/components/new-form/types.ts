/**
 * NewPlanningSheetForm — 共有型定義
 */
import type { PlanningSheetRepository, IspRepository } from '@/domain/isp/port';

export interface NewPlanningSheetFormProps {
  planningSheetRepo: PlanningSheetRepository;
  ispRepo: IspRepository;
  initialUserId?: string;
  initialSource?: string;
  diffSummary?: string;
}

export interface UserOption {
  id: string;
  label: string;
}

export interface FormState {
  // §1 基本情報
  title: string;
  supportLevel: string;
  behaviorScore: string;
  planPeriod: string;
  trainingLevel: string;
  relatedOrganizations: string;
  // §2 対象行動
  targetBehavior: string;
  behaviorFrequency: string;
  behaviorSituation: string;
  behaviorDuration: string;
  behaviorIntensity: string;
  behaviorRisk: string;
  behaviorImpact: string;
  // §3 氷山分析
  icebergSurface: string;
  triggers: string;
  environmentFactors: string;
  emotions: string;
  cognition: string;
  needs: string;
  // §4 FBA
  behaviorFunctions: string[];
  behaviorFunctionDetail: string;
  abcAntecedent: string;
  abcBehavior: string;
  abcConsequence: string;
  // §5 予防的支援
  environmentalAdjustment: string;
  visualSupport: string;
  communicationSupport: string;
  safetySupport: string;
  preSupport: string;
  // §6 代替行動
  desiredBehavior: string;
  teachingMethod: string;
  practiceMethod: string;
  reinforcementMethod: string;
  // §7 問題行動時対応
  initialResponse: string;
  responseEnvironment: string;
  safeguarding: string;
  staffResponse: string;
  recordMethod: string;
  // §8 危機対応
  dangerousBehavior: string;
  emergencyResponse: string;
  medicalCoordination: string;
  familyContact: string;
  safetyMethod: string;
  hasMedicalCoordination: boolean;
  // §9 モニタリング
  evaluationIndicator: string;
  evaluationPeriod: string;
  evaluationMethod: string;
  improvementResult: string;
  nextSupport: string;
  monitoringCycleDays: number;
  // §10 チーム共有
  sharingMethod: string;
  training: string;
  personInCharge: string;
  confirmationDate: string;
  teamConsensusNote: string;
}
