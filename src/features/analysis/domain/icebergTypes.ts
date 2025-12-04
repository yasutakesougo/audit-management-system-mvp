import type { AssessmentItem } from '@/features/assessment/domain/types';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';

export type IcebergNodeType = 'behavior' | 'assessment' | 'environment';

export type NodePosition = {
  x: number;
  y: number;
};

export type IcebergNode = {
  id: string;
  type: IcebergNodeType;
  label: string;
  details?: string;
  sourceId?: string;
  position: NodePosition;
};

export type HypothesisLink = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
};

export type IcebergSession = {
  id: string;
  targetUserId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: IcebergNode[];
  links: HypothesisLink[];
};
export type EnvironmentFactor = {
  id: string;
  topic: string;
  description?: string;
};

export type IcebergSource = BehaviorObservation | AssessmentItem | EnvironmentFactor;
