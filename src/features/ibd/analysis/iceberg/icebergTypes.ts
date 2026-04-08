import { z } from 'zod';
import type { AssessmentItem } from '@/features/assessment/domain/types';
import type { ABCRecord } from '@/domain/behavior';

export type IcebergSessionStatus = 'draft' | 'active' | 'archived';
export type IcebergNodeType = 'behavior' | 'assessment' | 'environment';

export type NodePosition = {
  x: number;
  y: number;
};

export type IcebergNodeStatus = 'fact' | 'hypothesis' | 'validated';

export type IcebergNode = {
  id: string;
  type: IcebergNodeType;
  label: string;
  details?: string;
  sourceId?: string;
  position: NodePosition;
  status: IcebergNodeStatus;
  statusRationale?: string; // Why this status was chosen (especially for validated)
  updatedAt?: string;
  evidenceRecordIds?: string[]; // IDs of linked support records
};

export type HypothesisLink = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  confidence: 'high' | 'medium' | 'low';
  status: 'hypothesis' | 'validated'; // Added link status
  statusRationale?: string; // Why this status was chosen (especially for validated)
  note?: string;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
  evidenceRecordIds?: string[]; // IDs of linked support records
};

export type IcebergEventType = 
  | 'session_created'
  | 'node_added' 
  | 'node_deleted'
  | 'link_added' 
  | 'link_deleted'
  | 'confidence_changed' 
  | 'note_updated' 
  | 'status_changed' // Added status change event
  | 'evidence_linked' // Added evidence audit
  | 'evidence_unlinked' // Added evidence audit
  | 'meeting_comment';

export type IcebergEvent = {
  id: string;
  type: IcebergEventType;
  timestamp: string;
  userId?: string;
  userName?: string;
  targetId?: string; // node id or link id
  message: string;  // Human readable description
  payload?: Record<string, unknown>;    // Optional machine readable data
};

export type IcebergSession = {
  id: string;
  targetUserId: string;
  /** 紐づく支援計画シートID（optional: 旧データ互換） */
  planningSheetId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: IcebergNode[];
  links: HypothesisLink[];
  logs: IcebergEvent[];
  status: IcebergSessionStatus;
};
export type EnvironmentFactor = {
  id: string;
  topic: string;
  description?: string;
};

export type IcebergSource = ABCRecord | AssessmentItem | EnvironmentFactor;
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
  status: z.enum(['fact', 'hypothesis', 'validated'] as const).default('hypothesis'),
  statusRationale: z.string().optional(),
  updatedAt: z.string().datetime().optional(),
  evidenceRecordIds: z.array(z.string()).optional(),
});

export type IcebergNodeValidated = z.infer<typeof icebergNodeSchema>;

/** Link Zod schema: Validate node references and confidence */
export const icebergLinkSchema = z.object({
  id: z.string().min(1, 'Link ID must not be empty'),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low'] as const).default('low'),
  status: z.enum(['hypothesis', 'validated'] as const).default('hypothesis'), // Added link status
  statusRationale: z.string().optional(),
  note: z.string().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  updatedAt: z.string().datetime().optional(),
  evidenceRecordIds: z.array(z.string()).optional(),
});

export const icebergEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    'session_created',
    'node_added',
    'node_deleted',
    'link_added',
    'link_deleted',
    'confidence_changed',
    'note_updated',
    'status_changed',
    'evidence_linked',
    'evidence_unlinked',
    'meeting_comment'
  ] as const),
  timestamp: z.string().datetime(),
  userId: z.string().optional(),
  userName: z.string().optional(),
  targetId: z.string().optional(),
  message: z.string(),
  payload: z.any().optional(),
});

export type IcebergLinkValidated = z.infer<typeof icebergLinkSchema>;

/** Snapshot Zod schema: Full state serializable for SharePoint */
export const icebergSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: z.string().min(1, 'Session ID required'),
  userId: z.string().min(1, 'User ID required'),
  /** 紐づく支援計画シートID（optional: 旧データ互換） */
  planningSheetId: z.string().min(1).optional(),
  title: z.string().min(1, 'Title required'),
  updatedAt: z.string().datetime('Must be ISO datetime'),
  nodes: z.array(icebergNodeSchema),
  links: z.array(icebergLinkSchema),
  logs: z.array(icebergEventSchema).default([]),
  status: z.enum(['draft', 'active', 'archived'] as const).default('active'),
});

export type IcebergSnapshot = z.infer<typeof icebergSnapshotSchema>;
