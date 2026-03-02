// Public API for the IBD (Individual Behavior Design) feature module.
// Cross-domain consumers should import from this barrel only.

// ISP Editor (public hooks and types)
export type { GoalItem } from './plans/isp-editor/data/ispRepo';
export { useISPComparisonEditor } from './plans/isp-editor/hooks/useISPComparisonEditor';
export type { DomainCoverage, ProgressInfo, UseISPComparisonEditorOptions } from './plans/isp-editor/hooks/useISPComparisonEditor';

// Iceberg (public store and types)
export { useIcebergStore } from './analysis/iceberg/icebergStore';
export type { EnvironmentFactor, HypothesisLink, IcebergNode, IcebergNodeType, IcebergSession, NodePosition } from './analysis/iceberg/icebergTypes';

// PDCA (public analysis)
export * from './analysis/pdca';
