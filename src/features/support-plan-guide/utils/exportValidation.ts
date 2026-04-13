import { FIELD_LIMITS, REQUIRED_FIELDS } from '../types';
import type { SupportPlanForm } from '../types';
import type { ExportValidationResult, ExportIssue } from '../types/export';
import { isIbdActive } from './exportTransformers';

/** 
 * PHYSICAL_RESTRAINT_CLAUSE — The mandatory wording for rights advocacy.
 */
export const PHYSICAL_RESTRAINT_CLAUSE = '身体拘束廃止の例外規定：緊急やむを得ない場合を除き、原則として身体拘束を行いません。';

/** 
 * validateExportContract — Runs all compliance checks on a form.
 */
export function validateExportContract(form: SupportPlanForm): ExportValidationResult {
  const issues: ExportIssue[] = [];
  
  // 1. Required Fields Check
  REQUIRED_FIELDS.forEach((key) => {
    const value = form[key as keyof SupportPlanForm];
    if (typeof value === 'string' && !value.trim()) {
      issues.push({
        field: key,
        label: getFieldLabel(key),
        severity: 'block',
        message: '必須項目が未入力です。',
      });
    }
  });

  // 2. Character Limit Check
  (Object.keys(FIELD_LIMITS) as Array<keyof typeof FIELD_LIMITS>).forEach((key) => {
    const value = form[key];
    if (typeof value === 'string' && value.length > FIELD_LIMITS[key]) {
      issues.push({
        field: key,
        label: getFieldLabel(key),
        severity: 'warn',
        message: `文字数制限（${FIELD_LIMITS[key]}文字）を超えています。出力時に切り捨てられる可能性があります。`,
        actual: value.length,
        max: FIELD_LIMITS[key],
      });
    }
  });

  // 3. Clause Check (Rights Advocacy)
  if (form.rightsAdvocacy && !form.rightsAdvocacy.includes('身体拘束')) {
    issues.push({
      field: 'rightsAdvocacy',
      label: '権利擁護',
      severity: 'warn',
      message: '身体拘束に関する例外規定の文言が含まれていない可能性があります。',
    });
  }

  // 4. Goal Count Check
  const longGoalCount = form.goals.filter(g => g.type === 'long').length;
  if (longGoalCount === 0) {
    issues.push({
      field: 'goals',
      label: '目標設定',
      severity: 'block',
      message: '長期目標が設定されていません。',
    });
  } else if (longGoalCount > 2) {
    issues.push({
      field: 'goals',
      label: '目標設定',
      severity: 'warn',
      message: '長期目標が3件以上あります。公式様式では上位2件のみ出力されます。',
    });
  }

  const blockCount = issues.filter(i => i.severity === 'block').length;
  const warnCount = issues.filter(i => i.severity === 'warn').length;

  return {
    isExportable: blockCount === 0,
    issues,
    passCount: 0, // Not strictly calculated now
    warnCount,
    blockCount,
    ibdIncluded: isIbdActive(form),
  };
}

/** 
 * Map keys to human readable labels (mock or real from config).
 */
function getFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    serviceUserName: '利用者名',
    supportLevel: '支援区分',
    planPeriod: '計画期間',
    attendingDays: '通所日数',
    userRole: '本人の役割',
    assessmentSummary: 'アセスメント概要',
    decisionSupport: '意思決定支援',
    monitoringPlan: 'モニタリング計画',
    riskManagement: 'リスク管理',
    rightsAdvocacy: '権利擁護',
  };
  return labels[key] || key;
}
