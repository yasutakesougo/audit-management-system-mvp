import type { AssessmentItem } from '@/features/assessment/domain/types';
import type { ABCRecord } from '@/domain/behavior';
import type { IcebergRepository } from '@/features/ibd/analysis/iceberg/SharePointIcebergRepository';
import { ConflictError } from '@/features/ibd/analysis/iceberg/errors';
import type {
  EnvironmentFactor,
  HypothesisLink,
  IcebergNode,
  IcebergNodeStatus,
  IcebergNodeType,
  IcebergSession,
  IcebergSessionStatus,
  IcebergSnapshot,
  IcebergEvent,
  IcebergEventType,
  NodePosition,
} from '@/features/ibd/analysis/iceberg/icebergTypes';
import { icebergSnapshotSchema } from '@/features/ibd/analysis/iceberg/icebergTypes';
import { sha256Hex } from '@/lib/hashUtil';
import { useCallback } from 'react';
import { create } from 'zustand';

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

interface IcebergState {
  currentSession: IcebergSession | null;
  sessions: Record<string, IcebergSession>;
  // Persistence metadata
  saveState: SaveState;
  lastSaveError?: string;
  lastSavedAt?: string;
  lastEntryHash?: string;
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

const initialState: IcebergState = {
  currentSession: null,
  sessions: {},
  saveState: 'idle',
  lastSaveError: undefined,
  lastSavedAt: undefined,
  lastEntryHash: undefined,
};

const MAX_LOG_ENTRIES = 100;

const useIcebergStoreBase = create<IcebergState>()(() => ({ ...initialState }));

// Non-React helpers
const getState = useIcebergStoreBase.getState;
const setState = useIcebergStoreBase.setState;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const persistSession = (session: IcebergSession) => {
  setState((s) => ({
    ...s,
    currentSession: session,
    sessions: {
      ...s.sessions,
      [session.id]: session,
    },
  }));
};

const logEvent = (
  session: IcebergSession, 
  type: IcebergEventType, 
  message: string, 
  opts?: { targetId?: string; payload?: Record<string, unknown>; userId?: string; userName?: string }
): IcebergSession => {
  const newEvent: IcebergEvent = {
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: new Date().toISOString(),
    message,
    targetId: opts?.targetId,
    payload: opts?.payload,
    userId: opts?.userId,
    userName: opts?.userName,
  };
  
  const nextLogs = [...(session.logs || []), newEvent];
  // Keep only the latest 100 entries to prevent storage bloat
  return {
    ...session,
    logs: nextLogs.slice(-MAX_LOG_ENTRIES),
  };
};

const inferBehaviorDetails = (source: ABCRecord): string | undefined => {
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

type NodeSource = ABCRecord | AssessmentItem | EnvironmentFactor;

const toNode = (data: NodeSource, type: IcebergNodeType, initialPos?: NodePosition, status: IcebergNodeStatus = 'hypothesis'): IcebergNode => {
  if (type === 'behavior') {
    const behavior = data as ABCRecord;
    return {
      id: `node-${behavior.id}`,
      type,
      label: behavior.behavior,
      details: inferBehaviorDetails(behavior),
      sourceId: behavior.id,
      position: initialPos ?? { x: 160, y: 120 },
      status,
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
      status,
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
    status,
  };
};

const initSession = (userId: string, title: string, status: IcebergSessionStatus = 'active'): IcebergSession => {
  const timestamp = new Date().toISOString();
  const newSession: IcebergSession = {
    id: `session-${Date.now()}`,
    targetUserId: userId,
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    nodes: [],
    links: [],
    logs: [
      {
        id: `event-${Date.now()}`,
        type: 'session_created',
        timestamp,
        message: `セッション "${title}" が開始されました`,
      }
    ],
    status,
  };
  persistSession(newSession);
  return newSession;
};

const setSessionStatus = (status: IcebergSessionStatus) => {
  updateSession((session) => ({
    ...session,
    status
  }));
};

const updateSession = (updater: (session: IcebergSession) => IcebergSession | null) => {
  const state = getState();
  if (!state.currentSession) {
    return;
  }
  const updated = updater(state.currentSession);
  if (!updated) return;
  persistSession({ ...updated, updatedAt: new Date().toISOString() });
};

const addNodeFromData = (data: NodeSource, type: IcebergNodeType, initialPos?: NodePosition, status: IcebergNodeStatus = 'hypothesis') => {
  updateSession((session) => {
    const exists = session.nodes.some((node) => node.sourceId === data.id);
    if (exists) {
      return session;
    }
    const node = toNode(data, type, initialPos, status);
    const nextSession = {
      ...session,
      nodes: [...session.nodes, node],
    };
    return logEvent(nextSession, 'node_added', `「${node.label}」を分析ボードに追加しました`, { targetId: node.id });
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

const updateNode = (updatedNode: IcebergNode, userId?: string) => {
  updateSession((session) => {
    const timestamp = new Date().toISOString();
    const oldNode = session.nodes.find(n => n.id === updatedNode.id);
    const nodes = session.nodes.map((n) => (n.id === updatedNode.id ? { ...updatedNode, updatedAt: timestamp } : n));
    let nextSession = { ...session, nodes };

    // --- Audit Logging ---
    if (oldNode) {
      // Status rationale change
      if (oldNode.statusRationale !== updatedNode.statusRationale && updatedNode.statusRationale) {
        nextSession = logEvent(nextSession, 'note_updated', `「${updatedNode.label}」の昇格理由・補足が追加されました`, { targetId: updatedNode.id, userId });
      }

      // Evidence linking
      const oldIds = oldNode.evidenceRecordIds || [];
      const newIds = updatedNode.evidenceRecordIds || [];
      const added = newIds.filter(id => !oldIds.includes(id));
      const removed = oldIds.filter(id => !newIds.includes(id));

      added.forEach(id => {
        nextSession = logEvent(nextSession, 'evidence_linked', `「${updatedNode.label}」に根拠記録を紐付けました`, { targetId: updatedNode.id, payload: { recordId: id }, userId });
      });
      removed.forEach(id => {
        nextSession = logEvent(nextSession, 'evidence_unlinked', `「${updatedNode.label}」から根拠記録を解除しました`, { targetId: updatedNode.id, payload: { recordId: id }, userId });
      });
    }

    return logEvent(nextSession, 'note_updated', `「${updatedNode.label}」の詳細が更新されました`, { targetId: updatedNode.id, userId });
  });
};

const deleteNode = (nodeId: string) => {
  updateSession((session) => {
    const nodes = session.nodes.filter((n) => n.id !== nodeId);
    const links = session.links.filter((l) => l.sourceNodeId !== nodeId && l.targetNodeId !== nodeId);
    const targetNode = session.nodes.find(n => n.id === nodeId);
    const nextSession = { ...session, nodes, links };
    return logEvent(nextSession, 'node_deleted', `「${targetNode?.label || nodeId}」を削除しました`, { targetId: nodeId });
  });
};

const updateLink = (updatedLink: HypothesisLink, userId?: string, userName?: string) => {
  updateSession((session) => {
    const oldLink = session.links.find(l => l.id === updatedLink.id);
    if (!oldLink) return session;

    const links = session.links.map((l) => (l.id === updatedLink.id ? updatedLink : l));
    let nextSession = { ...session, links };

    // Detect what changed for the log
    if (oldLink.confidence !== updatedLink.confidence) {
      const labelMap = { low: '仮説段階', medium: '有力候補', high: '実証済み' };
      nextSession = logEvent(nextSession, 'confidence_changed', 
        `確信度を ${labelMap[oldLink.confidence]} から ${labelMap[updatedLink.confidence]} に変更しました`,
        { targetId: updatedLink.id, payload: { from: oldLink.confidence, to: updatedLink.confidence }, userId, userName }
      );
    }
    if (oldLink.note !== updatedLink.note) {
      nextSession = logEvent(nextSession, 'note_updated', 
        `根拠・メモが更新されました`,
        { targetId: updatedLink.id, userId, userName }
      );
    }
    if (oldLink.status !== updatedLink.status) {
      const labelMap = { hypothesis: '仮説', validated: '検証済み' };
      nextSession = logEvent(nextSession, 'status_changed', 
        `因果関係の状態を ${labelMap[oldLink.status]} から ${labelMap[updatedLink.status]} に変更しました`,
        { targetId: updatedLink.id, payload: { from: oldLink.status, to: updatedLink.status }, userId, userName }
      );
    }

    // Status rationale change
    if (oldLink.statusRationale !== updatedLink.statusRationale && updatedLink.statusRationale) {
      nextSession = logEvent(nextSession, 'note_updated', `因果関係の昇格理由・補足が追加されました`, { targetId: updatedLink.id, userId, userName });
    }

    // Evidence linking for Links
    const oldIds = oldLink.evidenceRecordIds || [];
    const newIds = updatedLink.evidenceRecordIds || [];
    const added = newIds.filter(id => !oldIds.includes(id));
    const removed = oldIds.filter(id => !newIds.includes(id));

    added.forEach(id => {
      nextSession = logEvent(nextSession, 'evidence_linked', `因果関係に根拠記録を紐付けました`, { targetId: updatedLink.id, payload: { recordId: id }, userId, userName });
    });
    removed.forEach(id => {
      nextSession = logEvent(nextSession, 'evidence_unlinked', `因果関係から根拠記録を解除しました`, { targetId: updatedLink.id, payload: { recordId: id }, userId, userName });
    });

    return nextSession;
  });
};

const deleteLink = (linkId: string) => {
  updateSession((session) => {
    const links = session.links.filter((l) => l.id !== linkId);
    return { ...session, links };
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
      status: 'hypothesis', // Default status for new links
      note,
      updatedAt: new Date().toISOString(),
    };
    const nextSession = { ...session, links: [...session.links, newLink] };
    return logEvent(nextSession, 'link_added', `新しい因果関係が追加されました`, { targetId: newLink.id });
  });
};

const loadSession = (sessionId: string) => {
  const state = getState();
  const existing = state.sessions[sessionId];
  if (!existing) {
    return null;
  }
  persistSession(existing);
  return existing;
};

// ===== Persistence Functions (require repository) =====

const saveSnapshot = async (
  repository: IcebergRepository,
  opts: { userId: string; sessionId: string; title?: string }
) => {
  const { userId, sessionId, title } = opts;
  const state = getState();

  if (!state.currentSession) {
    throw new Error('No active session to save');
  }

  // Build snapshot from current state
  const snapshot: IcebergSnapshot = {
    schemaVersion: 1,
    userId,
    sessionId,
    planningSheetId: state.currentSession.planningSheetId,
    title: title ?? state.currentSession.title ?? `Iceberg Session ${sessionId}`,
    updatedAt: new Date().toISOString(),
    nodes: state.currentSession.nodes,
    links: state.currentSession.links,
    logs: state.currentSession.logs || [],
    status: state.currentSession.status || 'active',
  };

  // Validate with Zod
  const validated = icebergSnapshotSchema.parse(snapshot);

  // Compute idempotent key (nodes + links snapshot)
  const payloadFingerprint = JSON.stringify({
    n: validated.nodes.map((n) => [n.id, n.position]),
    l: validated.links.map((l) => [l.id, l.sourceNodeId, l.targetNodeId]),
  });
  const entryHash = await sha256Hex(`${userId}:${sessionId}:${payloadFingerprint}`);

  // Update save state
  setState((s) => ({ ...s, saveState: 'saving', lastSaveError: undefined }));

  try {
    const result = await repository.upsertSnapshot({
      entryHash,
      snapshot: validated,
    });

    setState((s) => ({
      ...s,
      saveState: 'saved',
      lastSavedAt: new Date().toISOString(),
      lastEntryHash: entryHash,
    }));

    return result;
  } catch (e: unknown) {
    const err = e as Record<string, unknown> | { message?: string };
    if (e instanceof ConflictError) {
      setState((s) => ({ ...s, saveState: 'conflict', lastSaveError: e.message }));
    } else {
      setState((s) => ({ ...s, saveState: 'error', lastSaveError: String(err?.message ?? e) }));
    }
    throw e;
  }
};

const loadLatest = async (repository: IcebergRepository, userId: string) => {
  setState((s) => ({ ...s, saveState: 'saving', lastSaveError: undefined }));

  try {
    const latest = await repository.getLatestByUser(userId);
    if (!latest) {
      setState((s) => ({ ...s, saveState: 'idle' }));
      return null;
    }

    // Convert snapshot back to IcebergSession
    const loaded: IcebergSession = {
      id: latest.sessionId,
      targetUserId: latest.userId,
      planningSheetId: latest.planningSheetId,
      title: latest.title,
      createdAt: new Date().toISOString(), // Snapshot doesn't track createdAt
      updatedAt: latest.updatedAt,
      nodes: latest.nodes,
      links: latest.links,
      logs: latest.logs || [],
      status: latest.status || 'active',
    };

    persistSession(loaded);
    setState((s) => ({ ...s, saveState: 'saved', lastSavedAt: latest.updatedAt }));

    return loaded;
  } catch (e: unknown) {
    const err = e as Record<string, unknown> | { message?: string };
    setState((s) => ({ ...s, saveState: 'error', lastSaveError: String(err?.message ?? e) }));
    throw e;
  }
};

// ---------------------------------------------------------------------------
// React Hook (backward-compatible)
// ---------------------------------------------------------------------------

export function useIcebergStore(repository?: IcebergRepository) {
  const store = useIcebergStoreBase();

  const init = useCallback((userId: string, title: string, status?: IcebergSessionStatus) => initSession(userId, title, status), []);
  const addNode = useCallback(
    (data: NodeSource, type: IcebergNodeType, position?: NodePosition, status?: IcebergNodeStatus) => addNodeFromData(data, type, position, status),
    [],
  );
  const move = useCallback((nodeId: string, position: NodePosition) => moveNode(nodeId, position), []);
  const updateNodeItem = useCallback((node: IcebergNode, uId?: string) => updateNode(node, uId), []);
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
    updateNode: updateNodeItem,
    deleteNode,
    linkNodes: link,
    updateLink: (updatedLink: HypothesisLink, uId?: string, uName?: string) => updateLink(updatedLink, uId, uName),
    deleteLink,
    setStatus: setSessionStatus,
    loadSession: load,
    savePersistent,
    loadPersistent,
  } as const;
}
