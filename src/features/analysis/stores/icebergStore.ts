import type {
    EnvironmentFactor,
    HypothesisLink,
    IcebergNode,
    IcebergNodeType,
    IcebergSession,
    NodePosition,
} from '@/features/analysis/domain/icebergTypes';
import type { AssessmentItem } from '@/features/assessment/domain/types';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { useCallback, useSyncExternalStore } from 'react';

type IcebergState = {
  currentSession: IcebergSession | null;
  sessions: Record<string, IcebergSession>;
};

let state: IcebergState = {
  currentSession: null,
  sessions: {},
};

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshot = () => state;

const persistSession = (session: IcebergSession) => {
  state = {
    currentSession: session,
    sessions: {
      ...state.sessions,
      [session.id]: session,
    },
  };
};

const inferBehaviorDetails = (source: BehaviorObservation): string | undefined => {
  if ('memo' in source && typeof source.memo === 'string' && source.memo.trim()) {
    return source.memo;
  }
  if ('note' in source && typeof source.note === 'string' && source.note.trim()) {
    return source.note;
  }
  return undefined;
};

const inferAssessmentDetails = (source: AssessmentItem): string | undefined => {
  if (source.description?.trim()) {
    return source.description;
  }
  return undefined;
};

type NodeSource = BehaviorObservation | AssessmentItem | EnvironmentFactor;

const toNode = (data: NodeSource, type: IcebergNodeType, initialPos?: NodePosition): IcebergNode => {
  if (type === 'behavior') {
    const behavior = data as BehaviorObservation;
    return {
      id: `node-${behavior.id}`,
      type,
      label: behavior.behavior,
      details: inferBehaviorDetails(behavior),
      sourceId: behavior.id,
      position: initialPos ?? { x: 160, y: 120 },
    };
  }

  if (type === 'assessment') {
    const assessment = data as AssessmentItem;
    return {
      id: `node-${assessment.id}`,
      type,
      label: assessment.topic,
      details: inferAssessmentDetails(assessment),
      sourceId: assessment.id,
      position: initialPos ?? { x: 180, y: 420 },
    };
  }

  const environment = data as EnvironmentFactor;
  return {
    id: `node-${environment.id}`,
    type,
    label: environment.topic,
    details: environment.description,
    sourceId: environment.id,
    position: initialPos ?? { x: 260, y: 360 },
  };
};

const initSession = (userId: string, title: string): IcebergSession => {
  const timestamp = new Date().toISOString();
  const newSession: IcebergSession = {
    id: `session-${Date.now()}`,
    targetUserId: userId,
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    nodes: [],
    links: [],
  };
  persistSession(newSession);
  emit();
  return newSession;
};

const updateSession = (updater: (session: IcebergSession) => IcebergSession | null) => {
  if (!state.currentSession) {
    return;
  }
  const updated = updater(state.currentSession);
  if (!updated) return;
  persistSession({ ...updated, updatedAt: new Date().toISOString() });
  emit();
};

const addNodeFromData = (data: NodeSource, type: IcebergNodeType, initialPos?: NodePosition) => {
  updateSession((session) => {
    const exists = session.nodes.some((node) => node.sourceId === data.id);
    if (exists) {
      return session;
    }
    const node = toNode(data, type, initialPos);
    return {
      ...session,
      nodes: [...session.nodes, node],
    };
  });
};

const moveNode = (nodeId: string, position: NodePosition) => {
  updateSession((session) => {
    let mutated = false;
    const nodes = session.nodes.map((node) => {
      if (node.id === nodeId) {
        mutated = true;
        return { ...node, position };
      }
      return node;
    });
    return mutated ? { ...session, nodes } : session;
  });
};

const linkNodes = (sourceNodeId: string, targetNodeId: string, confidence: HypothesisLink['confidence'] = 'medium', note?: string) => {
  updateSession((session) => {
    const exists = session.links.some(
      (link) => link.sourceNodeId === sourceNodeId && link.targetNodeId === targetNodeId,
    );
    if (exists) {
      return session;
    }
    const newLink: HypothesisLink = {
      id: `link-${Date.now()}`,
      sourceNodeId,
      targetNodeId,
      confidence,
      note,
    };
    return { ...session, links: [...session.links, newLink] };
  });
};

const loadSession = (sessionId: string) => {
  const existing = state.sessions[sessionId];
  if (!existing) {
    return null;
  }
  persistSession(existing);
  emit();
  return existing;
};

/**
 * Restore a session from a SharePoint snapshotJSON string.
 * Used when loading a saved session from the session list.
 */
const restoreSession = (snapshotJSON: string): IcebergSession | null => {
  try {
    const parsed = JSON.parse(snapshotJSON) as IcebergSession;
    if (!parsed.id || !parsed.targetUserId) return null;
    persistSession(parsed);
    emit();
    return parsed;
  } catch (err) {
    console.error('[IcebergStore] Failed to restore session:', err);
    return null;
  }
};

export function useIcebergStore() {
  const store = useSyncExternalStore(subscribe, snapshot, snapshot);

  const init = useCallback((userId: string, title: string) => initSession(userId, title), []);
  const addNode = useCallback(
    (data: NodeSource, type: IcebergNodeType, position?: NodePosition) => addNodeFromData(data, type, position),
    [],
  );
  const move = useCallback((nodeId: string, position: NodePosition) => moveNode(nodeId, position), []);
  const link = useCallback(
    (sourceNodeId: string, targetNodeId: string, confidence?: HypothesisLink['confidence'], note?: string) =>
      linkNodes(sourceNodeId, targetNodeId, confidence, note),
    [],
  );
  const load = useCallback((sessionId: string) => loadSession(sessionId), []);
  const restore = useCallback((json: string) => restoreSession(json), []);

  return {
    currentSession: store.currentSession,
    sessions: store.sessions,
    initSession: init,
    addNode,
    addNodeFromData: addNode,
    moveNode: move,
    linkNodes: link,
    loadSession: load,
    restoreSession: restore,
  } as const;
}

/**
 * Serialize IcebergSession to JSON for SharePoint storage.
 * Includes all fields (volatile + content).
 */
export const serializeSession = (session: IcebergSession): string => {
  const payload = {
    id: session.id,
    targetUserId: session.targetUserId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    nodes: session.nodes,
    links: session.links,
  };
  return JSON.stringify(payload);
};

/**
 * Build canonical JSON for hashing — only content-stable fields.
 * Excludes id, createdAt, updatedAt to ensure same content → same hash.
 * Nodes are sorted by id, links by id for key ordering stability.
 */
const buildCanonicalPayload = (session: IcebergSession): string => {
  const sortedNodes = [...session.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, type, label, details, sourceId, position }) => ({
      id, type, label, details, sourceId, position,
    }));

  const sortedLinks = [...session.links]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, sourceNodeId, targetNodeId, confidence, note }) => ({
      id, sourceNodeId, targetNodeId, confidence, note,
    }));

  return JSON.stringify({
    targetUserId: session.targetUserId,
    title: session.title,
    nodes: sortedNodes,
    links: sortedLinks,
  });
};

/**
 * Compute an SHA-256 hash for idempotent upsert.
 * Uses only content-stable fields — same content always produces the same hash.
 */
export const computeEntryHash = async (session: IcebergSession): Promise<string> => {
  const canonical = buildCanonicalPayload(session);
  const data = new TextEncoder().encode(canonical);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};
