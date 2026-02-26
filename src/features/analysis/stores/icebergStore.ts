import type {
    EnvironmentFactor,
    HypothesisLink,
    IcebergNode,
    IcebergNodeType,
    IcebergSession,
    NodePosition,
    IcebergSnapshot,
} from '@/features/analysis/domain/icebergTypes';
import { icebergSnapshotSchema } from '@/features/analysis/domain/icebergTypes';
import type { AssessmentItem } from '@/features/assessment/domain/types';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { useCallback, useSyncExternalStore } from 'react';
import type { IcebergRepository } from '@/features/analysis/infra/SharePointIcebergRepository';
import { ConflictError } from '@/features/analysis/infra/SharePointIcebergRepository';

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

type IcebergState = {
  currentSession: IcebergSession | null;
  sessions: Record<string, IcebergSession>;
  // Persistence metadata
  saveState: SaveState;
  lastSaveError?: string;
  lastSavedAt?: string;
  lastEntryHash?: string;
};

let state: IcebergState = {
  currentSession: null,
  sessions: {},
  saveState: 'idle',
  lastSaveError: undefined,
  lastSavedAt: undefined,
  lastEntryHash: undefined,
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
    ...state,
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

// ===== Persistence Functions (require repository) =====

/** Local helper to compute entry hash for idempotency */
function sha256Like(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return `h_${input.length}_${Math.abs(h)}`;
}

const saveSnapshot = async (
  repository: IcebergRepository,
  opts: { userId: string; sessionId: string; title?: string }
) => {
  const { userId, sessionId, title } = opts;

  if (!state.currentSession) {
    throw new Error('No active session to save');
  }

  // Build snapshot from current state
  const snapshot: IcebergSnapshot = {
    schemaVersion: 1,
    userId,
    sessionId,
    title: title ?? state.currentSession.title ?? `Iceberg Session ${sessionId}`,
    updatedAt: new Date().toISOString(),
    nodes: state.currentSession.nodes,
    links: state.currentSession.links,
  };

  // Validate with Zod
  const validated = icebergSnapshotSchema.parse(snapshot);

  // Compute idempotent key (nodes + links snapshot)
  const payloadFingerprint = JSON.stringify({
    n: validated.nodes.map((n) => [n.id, n.position]),
    l: validated.links.map((l) => [l.id, l.sourceNodeId, l.targetNodeId]),
  });
  const entryHash = sha256Like(`${userId}:${sessionId}:${payloadFingerprint}`);

  // Update save state
  state = { ...state, saveState: 'saving', lastSaveError: undefined };
  emit();

  try {
    const result = await repository.upsertSnapshot({
      entryHash,
      snapshot: validated,
    });

    state = {
      ...state,
      saveState: 'saved',
      lastSavedAt: new Date().toISOString(),
      lastEntryHash: entryHash,
    };
    emit();

    return result;
  } catch (e: unknown) {
    const err = e as Record<string, unknown> | { message?: string };
    if (e instanceof ConflictError) {
      state = { ...state, saveState: 'conflict', lastSaveError: e.message };
    } else {
      state = { ...state, saveState: 'error', lastSaveError: String(err?.message ?? e) };
    }
    emit();
    throw e;
  }
};

const loadLatest = async (repository: IcebergRepository, userId: string) => {
  state = { ...state, saveState: 'saving', lastSaveError: undefined };
  emit();

  try {
    const latest = await repository.getLatestByUser(userId);
    if (!latest) {
      state = { ...state, saveState: 'idle' };
      emit();
      return null;
    }

    // Convert snapshot back to IcebergSession
    const loaded: IcebergSession = {
      id: latest.sessionId,
      targetUserId: latest.userId,
      title: latest.title,
      createdAt: new Date().toISOString(), // Snapshot doesn't track createdAt
      updatedAt: latest.updatedAt,
      nodes: latest.nodes,
      links: latest.links,
    };

    persistSession(loaded);
    state = { ...state, saveState: 'saved', lastSavedAt: latest.updatedAt };
    emit();

    return loaded;
  } catch (e: unknown) {
    const err = e as Record<string, unknown> | { message?: string };
    state = { ...state, saveState: 'error', lastSaveError: String(err?.message ?? e) };
    emit();
    throw e;
  }
};

export function useIcebergStore(repository?: IcebergRepository) {
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

  // Persistence callbacks (require repository)
  const savePersistent = useCallback(
    (opts: { userId: string; sessionId: string; title?: string }) => {
      if (!repository) {
        throw new Error('Repository not provided to useIcebergStore');
      }
      return saveSnapshot(repository, opts);
    },
    [repository]
  );

  const loadPersistent = useCallback(
    (userId: string) => {
      if (!repository) {
        throw new Error('Repository not provided to useIcebergStore');
      }
      return loadLatest(repository, userId);
    },
    [repository]
  );

  return {
    currentSession: store.currentSession,
    sessions: store.sessions,
    saveState: store.saveState,
    lastSaveError: store.lastSaveError,
    lastSavedAt: store.lastSavedAt,
    initSession: init,
    addNode,
    addNodeFromData: addNode,
    moveNode: move,
    linkNodes: link,
    loadSession: load,
    savePersistent,
    loadPersistent,
  } as const;
}
