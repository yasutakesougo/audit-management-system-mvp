import { Layer, Maturity } from './types';

export const FEATURE_METADATA: Record<
  string,
  { layer: Layer; maturity: Maturity; prod?: boolean | 'partial' }
> = {
  // Execution
  today: { layer: 'Execution', maturity: 'Core', prod: true },
  daily: { layer: 'Execution', maturity: 'Core', prod: true },
  handoff: { layer: 'Execution', maturity: 'Core', prod: true },
  nurse: { layer: 'Execution', maturity: 'Core', prod: true },
  timeline: { layer: 'Execution', maturity: 'Expanding', prod: true },
  dailyOps: { layer: 'Execution', maturity: 'Core', prod: true },
  meeting: { layer: 'Execution', maturity: 'Core', prod: true },
  'meeting-minutes': { layer: 'Execution', maturity: 'Core', prod: true },
  callLogs: { layer: 'Execution', maturity: 'Expanding', prod: 'partial' },
  dashboard: { layer: 'Execution', maturity: 'Core', prod: true },

  // Decision
  assessment: { layer: 'Decision', maturity: 'Expanding', prod: true },
  'planning-sheet': { layer: 'Decision', maturity: 'Expanding', prod: true },
  'support-plan-guide': { layer: 'Decision', maturity: 'Expanding', prod: true },
  ibd: { layer: 'Decision', maturity: 'Expanding', prod: true },
  analysis: { layer: 'Decision', maturity: 'Expanding', prod: true },
  monitoring: { layer: 'Decision', maturity: 'Expanding', prod: true },
  recommendation: { layer: 'Decision', maturity: 'Prototype', prod: false },
  'tag-analytics': { layer: 'Decision', maturity: 'Prototype', prod: false },

  // Operations
  schedules: { layer: 'Operations', maturity: 'Core', prod: true },
  resources: { layer: 'Operations', maturity: 'Expanding', prod: true },
  'transport-assignments': { layer: 'Operations', maturity: 'Prototype', prod: 'partial' },
  operationFlow: { layer: 'Operations', maturity: 'Expanding', prod: true },
  'ops-dashboard': { layer: 'Operations', maturity: 'Expanding', prod: 'partial' },
  planDeployment: { layer: 'Operations', maturity: 'Dormant', prod: false },

  // Governance
  audit: { layer: 'Governance', maturity: 'Core', prod: true },
  'compliance-checklist': { layer: 'Governance', maturity: 'Core', prod: true },
  regulatory: { layer: 'Governance', maturity: 'Expanding', prod: true },
  safety: { layer: 'Governance', maturity: 'Expanding', prod: true },
  exceptions: { layer: 'Governance', maturity: 'Expanding', prod: true },
  import: { layer: 'Governance', maturity: 'Core', prod: true },

  // Platform
  users: { layer: 'Platform', maturity: 'Core', prod: true },
  staff: { layer: 'Platform', maturity: 'Core', prod: true },
  auth: { layer: 'Platform', maturity: 'Core', prod: true },
  attendance: { layer: 'Platform', maturity: 'Core', prod: true },
  org: { layer: 'Platform', maturity: 'Core', prod: true },
  telemetry: { layer: 'Platform', maturity: 'Infra', prod: true },
  settings: { layer: 'Platform', maturity: 'Infra', prod: true },
  'cross-module': { layer: 'Platform', maturity: 'Infra', prod: true },
  shared: { layer: 'Platform', maturity: 'Infra', prod: true },
  'operation-hub': { layer: 'Platform', maturity: 'Infra', prod: true },
  context: { layer: 'Platform', maturity: 'Infra', prod: true },
  diagnostics: { layer: 'Platform', maturity: 'Infra', prod: true },
  demo: { layer: 'Platform', maturity: 'Infra', prod: false },
  accessibility: { layer: 'Platform', maturity: 'Infra', prod: true },
  'action-engine': { layer: 'Platform', maturity: 'Prototype', prod: 'partial' },

  // Output
  'service-provision': { layer: 'Output', maturity: 'Core', prod: true },
  'kokuhoren-csv': { layer: 'Output', maturity: 'Core', prod: true },
  'kokuhoren-preview': { layer: 'Output', maturity: 'Core', prod: true },
  'kokuhoren-validation': { layer: 'Output', maturity: 'Core', prod: true },
  billing: { layer: 'Output', maturity: 'Expanding', prod: true },
  'official-forms': { layer: 'Output', maturity: 'Core', prod: true },
  records: { layer: 'Output', maturity: 'Core', prod: true },
  reports: { layer: 'Output', maturity: 'Expanding', prod: 'partial' },
};
