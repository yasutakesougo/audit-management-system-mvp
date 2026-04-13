import type { SupportPlanExportModel } from '../types/export';
import { OFFICIAL_ISP_MAP, OFFICIAL_IBD_MAP } from './officialFieldMap';

/**
 * ExcelMappingResult — The "Flat Payload" for Excel generators.
 */
export interface ExcelMappingResult {
  filename: string;
  sheets: {
    name: string;
    rows: Array<{
      concept: string;
      value: string;
    }>;
  }[];
}

/**
 * mapToExcelPayload — Transforms the Export Model into an Excel-ready structure.
 * 
 * Logic:
 * 1. Categorize data according to OFFICIAL_MAP SSOT.
 * 2. Handle IBD conditional presence.
 * 3. Flatten goals for linear Excel rows.
 */
export function mapToExcelPayload(model: SupportPlanExportModel): ExcelMappingResult {
  const { coreIsp, goals, ibd, meta } = model;

  const ispRows: Array<{ concept: string; value: string }> = [
    { concept: OFFICIAL_ISP_MAP.header.userName, value: coreIsp.serviceUserName },
    { concept: OFFICIAL_ISP_MAP.header.level, value: coreIsp.supportLevel },
    { concept: OFFICIAL_ISP_MAP.header.period, value: coreIsp.planPeriod },
    { concept: OFFICIAL_ISP_MAP.header.attending, value: coreIsp.attendingDays },
    { concept: OFFICIAL_ISP_MAP.assessment.summary, value: coreIsp.assessmentSummary },
    { concept: OFFICIAL_ISP_MAP.assessment.decision, value: coreIsp.assessmentSummary }, // Note: reusing summary if decision is empty in some legacy
    { concept: OFFICIAL_ISP_MAP.management.monitoring, value: coreIsp.monitoringPlan },
    { concept: OFFICIAL_ISP_MAP.management.risk, value: coreIsp.riskManagement },
    { concept: OFFICIAL_ISP_MAP.management.rights, value: coreIsp.rightsAdvocacy },
  ];

  // Map Goals (top 2 as per contract)
  goals.longGoals.forEach((text, i) => {
    ispRows.push({ concept: `${OFFICIAL_ISP_MAP.goals.long}_${i + 1}`, value: text });
  });
  
  // Note: Short goals and measures are often mapped specific to the official page layout.
  // For basic payload, we just list them.
  goals.shortGoals.forEach((text, i) => {
    ispRows.push({ concept: `${OFFICIAL_ISP_MAP.goals.short}_${i + 1}`, value: text });
  });

  const sheets: ExcelMappingResult['sheets'] = [
    { name: '個別支援計画書', rows: ispRows }
  ];

  if (ibd.enabled) {
    sheets.push({
      name: '強度行動障害支援計画シート',
      rows: [
        { concept: OFFICIAL_IBD_MAP.identification.name, value: meta.userName },
        { concept: OFFICIAL_IBD_MAP.behavior.adjustment, value: ibd.envAdjustment },
        { concept: OFFICIAL_IBD_MAP.behavior.pbs, value: ibd.pbsStrategy },
      ]
    });
  }

  return {
    filename: `ISP_${coreIsp.serviceUserName}_${meta.exportedAt.slice(0, 10)}.xlsx`,
    sheets,
  };
}
