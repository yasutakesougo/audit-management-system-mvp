/**
 * SharePoint REST API Query Throttling and Limits configuration.
 */

export const SP_QUERY_LIMITS = {
  /** Default limit for UI queries (fast, lightweight) */
  default: 100,
  /** Recommended limit for background or data-heavy UI queries */
  recommended: 500,
  /** Hard maximum limit before the 5000 item threshold exception is triggered */
  hardMax: 4999,
};

export const SP_TELEMETRY_THRESHOLDS = {
  /** Queries taking longer than this are considered slow */
  slowQueryMs: 1000,
};
