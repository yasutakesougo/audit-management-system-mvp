/**
 * TodayScheduleLane — Thin view model for /today execution context
 *
 * This type is intentionally minimal. Only fields needed by /today UI
 * (NextActionCard, BriefingActionList) may exist here.
 *
 * It maps 1:1 with the ScheduleItem type used by useNextAction,
 * staying compatible with the existing dashboard ScheduleItem shape
 * while keeping /today decoupled from /schedules domain objects.
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */

/**
 * Minimal schedule lane item consumed by /today hooks.
 * Fields match the shape required by useNextAction.
 */
export type TodayScheduleLane = {
  /** Unique identifier for the schedule event */
  id: string;
  /** Start time in "HH:MM" format (for NextAction time calculation) */
  time: string;
  /** Display title */
  title: string;
  /** Location (optional) */
  location?: string;
  /** Owner / responsible party (optional) */
  owner?: string;
  /** Operational flow step — ties into OPS_FLOW_ORDER for sort tie-breaking */
  opsStep?: string;
};

/**
 * Lane grouping structure for /today.
 * Mirrors the shape that useNextAction expects.
 */
export type TodayScheduleLanes = {
  userLane: TodayScheduleLane[];
  staffLane: TodayScheduleLane[];
  organizationLane: TodayScheduleLane[];
};
