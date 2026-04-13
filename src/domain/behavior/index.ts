// ---------------------------------------------------------------------------
// domain/behavior — Barrel Export
// ---------------------------------------------------------------------------

export type {
    ABCRecord,
    BehaviorFunction,
    BehaviorIntensity,
    BehaviorMood,
    BehaviorOutcome,
    ObservationMaster,
    ReferencedStrategy,
    StrategyCategory,
} from './abc';

export {
    ALTERNATIVE_BEHAVIOR_RECOMMENDATIONS,
    DEFAULT_OBSERVATION_MASTER
} from './abc';

export {
    abcRecordPartialSchema,
    abcRecordSchema,
    behaviorFunctionSchema,
    behaviorIntensitySchema,
    behaviorMoodSchema,
    behaviorOutcomeSchema
} from './abc.schema';

export type { ABCRecordValidated } from './abc.schema';
export type { BehaviorObservationRepository } from './port';
