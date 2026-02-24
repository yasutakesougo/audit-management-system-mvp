import type { AssessmentItem } from '@/features/assessment';
import type { BehaviorObservation } from '@/features/daily';
import { z } from 'zod';

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
// ===== Zod Validation Schemas (for SharePoint persistence) =====

/** Node Zod schema: Validate positions and IDs */
export const icebergNodeSchema = z.object({
  id: z.string().min(1, 'Node ID must not be empty'),
  type: z.enum(['behavior', 'assessment', 'environment'] as const),
  label: z.string().min(1, 'Label must not be empty'),
  details: z.string().optional(),
  sourceId: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export type IcebergNodeValidated = z.infer<typeof icebergNodeSchema>;

/** Link Zod schema: Validate node references and confidence */
export const icebergLinkSchema = z.object({
  id: z.string().min(1, 'Link ID must not be empty'),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low'] as const),
  note: z.string().optional(),
});

export type IcebergLinkValidated = z.infer<typeof icebergLinkSchema>;

/** Snapshot Zod schema: Full state serializable for SharePoint */
export const icebergSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: z.string().min(1, 'Session ID required'),
  userId: z.string().min(1, 'User ID required'),
  title: z.string().min(1, 'Title required'),
  updatedAt: z.string().datetime('Must be ISO datetime'),
  nodes: z.array(icebergNodeSchema),
  links: z.array(icebergLinkSchema),
});

export type IcebergSnapshot = z.infer<typeof icebergSnapshotSchema>;
