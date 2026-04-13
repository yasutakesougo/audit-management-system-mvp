/** 
 * ExportIssue — A single validation finding during the export process.
 */
export interface ExportIssue {
  field: string;
  label: string;
  severity: 'warn' | 'block';
  message: string;
  actual?: number;
  max?: number;
}

/** 
 * ExportValidationResult — The summary of compliance checks for a draft.
 */
export interface ExportValidationResult {
  isExportable: boolean; // false if any 'block' issues exist
  issues: ExportIssue[];
  passCount: number;
  warnCount: number;
  blockCount: number;
  ibdIncluded: boolean;
}

/**
 * SupportPlanExportModel — The "Intermediate Model".
 * Flattened and ready for Excel or Markdown adapters.
 */
export interface SupportPlanExportModel {
  coreIsp: {
    serviceUserName: string;
    supportLevel: string;
    planPeriod: string;
    attendingDays: string;
    userRole: string;
    assessmentSummary: string;
    decisionSupport: string;
    monitoringPlan: string;
    riskManagement: string;
    rightsAdvocacy: string;
  };
  goals: {
    longGoals: string[];
    shortGoals: string[];
    supportMeasures: string[];
  };
  ibd: {
    enabled: boolean;
    envAdjustment: string;
    pbsStrategy: string;
  };
  compliance: ExportValidationResult;
  meta: {
    schemaVersion: string;
    exportedAt: string;
    sourceDraftId: string;
    userName: string;
  };
}
