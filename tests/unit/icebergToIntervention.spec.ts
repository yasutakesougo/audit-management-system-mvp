import { icebergToInterventionDrafts } from '@/features/analysis/domain/icebergToIntervention';
import type { IcebergSession } from '@/features/analysis/domain/icebergTypes';
import { describe, expect, it } from 'vitest';

const createSession = (overrides: Partial<IcebergSession> = {}): IcebergSession => ({
  id: 'session-1',
  targetUserId: 'user-1',
  title: 'テストセッション',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  nodes: [],
  links: [],
  ...overrides,
});

describe('icebergToInterventionDrafts', () => {
  it('ノードもリンクもない場合 → 空配列', () => {
    const session = createSession();
    expect(icebergToInterventionDrafts(session)).toEqual([]);
  });

  it('行動ノードのみ（リンクなし）→ 空triggerFactorsのDraft', () => {
    const session = createSession({
      nodes: [
        { id: 'n-beh-1', type: 'behavior', label: '他害(叩く)', position: { x: 0, y: 0 } },
      ],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'bip-n-beh-1',
      userId: 'user-1',
      targetBehavior: '他害(叩く)',
      targetBehaviorNodeId: 'n-beh-1',
      triggerFactors: [],
      strategies: { prevention: '', alternative: '', reactive: '' },
    });
  });

  it('行動+要因がリンクされている → triggerFactorsにマッピング', () => {
    const session = createSession({
      nodes: [
        { id: 'n-beh-1', type: 'behavior', label: '離席', position: { x: 0, y: 0 } },
        { id: 'n-asm-1', type: 'assessment', label: '聴覚過敏', position: { x: 0, y: 300 } },
        { id: 'n-env-1', type: 'environment', label: '工事騒音', position: { x: 100, y: 300 } },
      ],
      links: [
        { id: 'link-1', sourceNodeId: 'n-asm-1', targetNodeId: 'n-beh-1', confidence: 'high' },
        { id: 'link-2', sourceNodeId: 'n-env-1', targetNodeId: 'n-beh-1', confidence: 'medium' },
      ],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result).toHaveLength(1);
    expect(result[0].targetBehavior).toBe('離席');
    expect(result[0].triggerFactors).toHaveLength(2);
    expect(result[0].triggerFactors).toEqual(
      expect.arrayContaining([
        { label: '聴覚過敏', nodeId: 'n-asm-1' },
        { label: '工事騒音', nodeId: 'n-env-1' },
      ]),
    );
  });

  it('複数の行動ノード → 行動ごとにグルーピングされたDraft', () => {
    const session = createSession({
      nodes: [
        { id: 'n-beh-1', type: 'behavior', label: '他害', position: { x: 0, y: 0 } },
        { id: 'n-beh-2', type: 'behavior', label: 'パニック', position: { x: 200, y: 0 } },
        { id: 'n-asm-1', type: 'assessment', label: '触覚鈍麻', position: { x: 0, y: 300 } },
      ],
      links: [
        { id: 'link-1', sourceNodeId: 'n-asm-1', targetNodeId: 'n-beh-1', confidence: 'high' },
        { id: 'link-2', sourceNodeId: 'n-asm-1', targetNodeId: 'n-beh-2', confidence: 'low' },
      ],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result).toHaveLength(2);
    expect(result[0].targetBehavior).toBe('他害');
    expect(result[0].triggerFactors).toHaveLength(1);
    expect(result[1].targetBehavior).toBe('パニック');
    expect(result[1].triggerFactors).toHaveLength(1);
  });

  it('要因のみノード（行動なし）→ 空配列', () => {
    const session = createSession({
      nodes: [
        { id: 'n-asm-1', type: 'assessment', label: '聴覚過敏', position: { x: 0, y: 300 } },
      ],
    });
    expect(icebergToInterventionDrafts(session)).toEqual([]);
  });

  it('リンク先ノードが存在しない → スキップされる', () => {
    const session = createSession({
      nodes: [
        { id: 'n-beh-1', type: 'behavior', label: '他害', position: { x: 0, y: 0 } },
      ],
      links: [
        { id: 'link-1', sourceNodeId: 'n-missing', targetNodeId: 'n-beh-1', confidence: 'high' },
      ],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result).toHaveLength(1);
    expect(result[0].triggerFactors).toHaveLength(0);
  });

  it('重複リンクは1つにまとめられる', () => {
    const session = createSession({
      nodes: [
        { id: 'n-beh-1', type: 'behavior', label: '離席', position: { x: 0, y: 0 } },
        { id: 'n-asm-1', type: 'assessment', label: '聴覚過敏', position: { x: 0, y: 300 } },
      ],
      links: [
        { id: 'link-1', sourceNodeId: 'n-asm-1', targetNodeId: 'n-beh-1', confidence: 'high' },
        { id: 'link-2', sourceNodeId: 'n-asm-1', targetNodeId: 'n-beh-1', confidence: 'medium' },
      ],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result[0].triggerFactors).toHaveLength(1);
  });

  it('逆方向リンク（行動→要因）も正しく処理される', () => {
    const session = createSession({
      nodes: [
        { id: 'n-beh-1', type: 'behavior', label: '自傷', position: { x: 0, y: 0 } },
        { id: 'n-env-1', type: 'environment', label: '予定変更', position: { x: 0, y: 300 } },
      ],
      links: [
        { id: 'link-1', sourceNodeId: 'n-beh-1', targetNodeId: 'n-env-1', confidence: 'high' },
      ],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result).toHaveLength(1);
    expect(result[0].triggerFactors).toEqual([{ label: '予定変更', nodeId: 'n-env-1' }]);
  });
});
