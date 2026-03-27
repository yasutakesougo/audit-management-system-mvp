export type Layer =
  | 'Decision'
  | 'Execution'
  | 'Operations'
  | 'Governance'
  | 'Platform'
  | 'Output'
  | 'Unknown';

export type Maturity =
  | 'Core'
  | 'Expanding'
  | 'Prototype'
  | 'Dormant'
  | 'Infra'
  | 'Unknown';

export type SourceKind =
  | 'sharepoint'
  | 'firestore'
  | 'localStorage'
  | 'zustand'
  | 'memory'
  | 'msal'
  | 'pure-function'
  | 'excel'
  | 'unknown';

export interface RouteRef {
  path: string;
  file?: string;
  kind: 'route' | 'lazy' | 'derived';
}

export interface StorageRef {
  kind: SourceKind;
  detail?: string;
  listKeys?: string[];
  access?: Array<'R' | 'W' | 'D'>;
}

export interface BridgeRef {
  name: string;
  file: string;
  from?: string;
  to?: string;
  kind: 'bridge' | 'pipeline' | 'builder';
}

export interface FeatureMapEntry {
  feature: string;
  layer: Layer;
  maturity: Maturity;
  prod: boolean | 'partial' | 'unknown';
  routes: RouteRef[];
  storage: StorageRef[];
  bridges: BridgeRef[];
  filesCount: number;
  notes?: string[];
  reviewRequired: boolean;
}
