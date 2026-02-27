// ---------------------------------------------------------------------------
// Domain models for Iceberg-PDCA daily observations.
//
// ⚠️ MIGRATION NOTE (2026-02-27):
// BehaviorObservation is now a backward-compatible alias for ABCRecord
// from the unified domain/behavior module.
// New code should import directly from '@/domain/behavior'.
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

// Backward-compatible alias — existing code uses BehaviorObservation
export type { ABCRecord as BehaviorObservation } from '@/domain/behavior';

// Backward-compatible alias for MOCK_OBSERVATION_MASTER
export { DEFAULT_OBSERVATION_MASTER as MOCK_OBSERVATION_MASTER } from '@/domain/behavior';
