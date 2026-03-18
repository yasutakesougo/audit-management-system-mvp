import { DEFAULT_SP_QUERY_LIMIT, MAX_SP_QUERY_LIMIT } from '@/shared/api/spQueryLimits';

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
 * Validates and sanitizes a SharePoint REST API query.
 * Assesses its risk level based on the current context and parameters to detect potentially dangerous patterns,
 * such as unlimited retrievals, expensive joins (expand), or unindexed filtering.
 */
export function guardSharePointQuery(params: GuardedQueryParams): GuardedQueryResult {
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
    sanitized.top = DEFAULT_SP_QUERY_LIMIT;
  } else if (params.top < 1) {
    sanitized.top = 1;
    flags.cappedTop = true;
    warningCodes.push('TOP_CAPPED');
    warnings.push(`Query top increased from ${params.top} to minimum allowed value of 1.`);
  } else if (params.top > MAX_SP_QUERY_LIMIT) {
    sanitized.top = MAX_SP_QUERY_LIMIT;
    flags.cappedTop = true;
    warningCodes.push('TOP_CAPPED');
    warnings.push(`Query top reduced from ${params.top} to MAX_SP_QUERY_LIMIT (${MAX_SP_QUERY_LIMIT}).`);
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
