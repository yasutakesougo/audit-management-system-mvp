import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

export type SharePointQueryRiskLevel = 'low' | 'medium' | 'high';

export interface GuardedQueryParams {
  top?: number;
  select?: string[];
  expand?: string[];
  orderBy?: string | null;
  filter?: string | null;
  listName?: string | null;
  queryKind?: string | null; // e.g., 'list', 'detail', 'search', 'export', 'analytics'
}

export interface GuardedQueryResult {
  sanitized: GuardedQueryParams;
  warnings: string[];
  warningCodes: string[];
  riskLevel: SharePointQueryRiskLevel;
  flags: {
    cappedTop: boolean;
    missingSelect: boolean;
    hasExpand: boolean;
    missingOrderBy: boolean;
    filterMayNeedIndex: boolean;
  };
}

// Simple heuristic for filters that might require index
// e.g. substringof, startswith, eq, ge, le, Id, Date, etc.
const filterNeedsIndexPattern = /(substringof|startswith| eq | ge | le |Id|Date)/i;

/**
 * Validates a SharePoint REST API query and evaluates its risk level.
 * This is a pure function that returns a structured assessment (sanitized params, risk level, warnings)
 * without side-effects or throws.
 */
export function evaluateQueryRisk(params: GuardedQueryParams): GuardedQueryResult {
  const flags = {
    cappedTop: false,
    missingSelect: false,
    hasExpand: false,
    missingOrderBy: false,
    filterMayNeedIndex: false,
  };

  const warnings: string[] = [];
  const warningCodes: string[] = [];
  const sanitized: GuardedQueryParams = { ...params };
  
  // A. Check and sanitize `top`
  if (params.top === undefined || params.top === null) {
    sanitized.top = SP_QUERY_LIMITS.default;
  } else if (params.top < 1) {
    sanitized.top = 1;
    flags.cappedTop = true;
    warningCodes.push('TOP_CAPPED');
    warnings.push(`Query top increased from ${params.top} to minimum allowed value of 1.`);
  } else if (params.top > SP_QUERY_LIMITS.hardMax) {
    sanitized.top = SP_QUERY_LIMITS.hardMax;
    flags.cappedTop = true;
    warningCodes.push('TOP_CAPPED');
    warnings.push(`Query top reduced from ${params.top} to hard max limit (${SP_QUERY_LIMITS.hardMax}).`);
  } else if (params.top > SP_QUERY_LIMITS.recommended) {
    warningCodes.push('TOP_EXCEEDS_RECOMMENDED');
    warnings.push(`Query top (${params.top}) exceeds recommended limit (${SP_QUERY_LIMITS.recommended}). Use pagination if possible.`);
  }

  // B. Check `select`
  if (!params.select || params.select.length === 0) {
    flags.missingSelect = true;
    warningCodes.push('SELECT_MISSING');
    warnings.push('Query omits $select. This risks returning large amounts of unneeded data and hitting the 2MB response size limit.');
  }

  // C. Check `expand`
  let expandCount = 0;
  if (params.expand && params.expand.length > 0) {
    flags.hasExpand = true;
    expandCount = params.expand.length;
    warningCodes.push('HAS_EXPAND');
    warnings.push(`Query contains ${expandCount} $expand parameter(s).`);
  }

  // D. Check `orderBy`
  // Usually missing OrderBy is most problematic for listing multiple items
  const isListQuery = params.queryKind !== 'detail'; 
  if (isListQuery && !params.orderBy && sanitized.top !== 1) {
    flags.missingOrderBy = true;
    warningCodes.push('ORDERBY_MISSING');
    warnings.push('Query for multiple items missing $orderby. Results may be inconsistently sorted or cause pagination issues.');
  }

  // E. Check `filter` heuristic for index need
  if (params.filter) {
    if (filterNeedsIndexPattern.test(params.filter)) {
      flags.filterMayNeedIndex = true;
      warningCodes.push('FILTER_MAY_NEED_INDEX');
      warnings.push(`Query uses $filter (${params.filter}) that may rely on non-indexed columns, risking 5000-item threshold failures.`);
    }
  }

  // F. Calculate Risk Level
  let riskLevel: SharePointQueryRiskLevel = 'low';

  const isExportOrAnalytics = params.queryKind === 'export' || params.queryKind === 'analytics';
  const hasLargeTop = (sanitized.top ?? 0) > 1000;

  // High Risk Thresholds
  if (flags.cappedTop) {
    riskLevel = 'high';
  } else if (expandCount > 1) {
    riskLevel = 'high';
  } else if (flags.missingSelect && flags.hasExpand) {
    riskLevel = 'high';
  } else if (flags.missingOrderBy && hasLargeTop) {
    riskLevel = 'high';
  } else if (flags.filterMayNeedIndex && flags.hasExpand) {
    riskLevel = 'high';
  } else if (isExportOrAnalytics && hasLargeTop) {
    riskLevel = 'high';
  } 
  // Medium Risk Thresholds
  else if (flags.missingSelect || flags.missingOrderBy || flags.filterMayNeedIndex || expandCount === 1) {
    riskLevel = 'medium';
  }

  return {
    sanitized,
    warnings,
    warningCodes,
    riskLevel,
    flags,
  };
}

export interface EnforcePolicyOptions {
  /**
   * If true, throws an error when riskLevel is 'high'. 
   * Useful when strict policies are enforced (e.g., in critical paths).
   */
  throwOnHighRisk?: boolean;
}

/**
 * Enforcer function that receives the result of `evaluateQueryRisk` and decides
 * whether to block the query or let it pass based on policy options.
 */
export function enforceQueryPolicy(result: GuardedQueryResult, options: EnforcePolicyOptions = {}): GuardedQueryResult {
  const { throwOnHighRisk = false } = options;

  if (result.riskLevel === 'high' && throwOnHighRisk) {
    throw new Error(`[SharePoint Safety Engine] Blocked high-risk query. Reasons: ${result.warningCodes.join(', ')}`);
  }

  return result;
}
