import { describe, expect, it, beforeEach } from 'vitest';

// We need to test the store actions. Import the hook and use it directly.
// Since the store is Zustand-based and actions are module-scoped functions,
// we test through the hook's returned methods.
import { useIcebergStore } from '../icebergStore';
import { act, renderHook } from '@testing-library/react';

describe('icebergStore — node CRUD actions', () => {
  beforeEach(() => {
    // Reset store by initializing a fresh session
    const { result } = renderHook(() => useIcebergStore());
    act(() => {
      result.current.initSession('test-user', 'Test Session');
    });
  });

  it('addManualNode adds a node to the session', () => {
    const { result } = renderHook(() => useIcebergStore());
    act(() => {
      result.current.addManualNode('テスト行動', 'behavior', '詳細メモ');
    });
    const session = result.current.currentSession;
    expect(session?.nodes).toHaveLength(1);
    expect(session?.nodes[0].label).toBe('テスト行動');
    expect(session?.nodes[0].type).toBe('behavior');
    expect(session?.nodes[0].details).toBe('詳細メモ');
    expect(session?.nodes[0].id).toMatch(/^node-manual-/);
  });

  it('updateNode updates label and type', () => {
    const { result } = renderHook(() => useIcebergStore());
    act(() => {
      result.current.addManualNode('元のラベル', 'behavior');
    });
    const nodeId = result.current.currentSession!.nodes[0].id;
    act(() => {
      result.current.updateNode(nodeId, { label: '更新後', type: 'assessment' });
    });
    const updated = result.current.currentSession!.nodes.find((n) => n.id === nodeId);
    expect(updated?.label).toBe('更新後');
    expect(updated?.type).toBe('assessment');
  });

  it('removeNode removes the node and its links', () => {
    const { result } = renderHook(() => useIcebergStore());
    act(() => {
      result.current.addManualNode('ノードA', 'behavior');
    });
    act(() => {
      result.current.addManualNode('ノードB', 'assessment');
    });
    expect(result.current.currentSession!.nodes).toHaveLength(2);
    const nodeA = result.current.currentSession!.nodes[0].id;
    const nodeB = result.current.currentSession!.nodes[1].id;
    act(() => {
      result.current.linkNodes(nodeA, nodeB);
    });
    expect(result.current.currentSession!.links).toHaveLength(1);
    act(() => {
      result.current.removeNode(nodeA);
    });
    expect(result.current.currentSession!.nodes).toHaveLength(1);
    expect(result.current.currentSession!.nodes[0].id).toBe(nodeB);
    // Link referencing removed node should also be removed
    expect(result.current.currentSession!.links).toHaveLength(0);
  });

  it('removeLink removes a specific link', () => {
    const { result } = renderHook(() => useIcebergStore());
    act(() => {
      result.current.addManualNode('ノードA', 'behavior');
      result.current.addManualNode('ノードB', 'assessment');
    });
    const nodeA = result.current.currentSession!.nodes[0].id;
    const nodeB = result.current.currentSession!.nodes[1].id;
    act(() => {
      result.current.linkNodes(nodeA, nodeB);
    });
    const linkId = result.current.currentSession!.links[0].id;
    act(() => {
      result.current.removeLink(linkId);
    });
    expect(result.current.currentSession!.links).toHaveLength(0);
    // Nodes should remain
    expect(result.current.currentSession!.nodes).toHaveLength(2);
  });

  it('addManualNode without details creates node with undefined details', () => {
    const { result } = renderHook(() => useIcebergStore());
    act(() => {
      result.current.addManualNode('シンプルノード', 'environment');
    });
    const node = result.current.currentSession!.nodes[0];
    expect(node.label).toBe('シンプルノード');
    expect(node.type).toBe('environment');
    expect(node.details).toBeUndefined();
  });

  it('updateNode with non-existent id does nothing', () => {
    const { result } = renderHook(() => useIcebergStore());
    act(() => {
      result.current.addManualNode('既存ノード', 'behavior');
    });
    const _before = result.current.currentSession!.updatedAt;
    act(() => {
      result.current.updateNode('non-existent', { label: '変更' });
    });
    // Node should be unchanged
    expect(result.current.currentSession!.nodes[0].label).toBe('既存ノード');
  });
});
