// ---------------------------------------------------------------------------
// Domain models for daily observations.
//
// All behavior-related types are re-exported from the single source of truth
// at '@/domain/behavior'. Import directly from there for new code.
// ---------------------------------------------------------------------------

// Re-export unified types from domain/behavior
export type {
    ABCRecord,
    BehaviorFunction,
    BehaviorIntensity,
    BehaviorMood,
    BehaviorOutcome,
    ObservationMaster
} from '@/domain/behavior';

export { DEFAULT_OBSERVATION_MASTER } from '@/domain/behavior';
