import { icebergToInterventionDrafts } from '@/features/ibd/analysis/iceberg/icebergToIntervention';
import type { HypothesisLink, IcebergNode, IcebergSession } from '@/features/ibd/analysis/iceberg/icebergTypes';
import { describe, expect, it } from 'vitest';

const createSession = (overrides: Partial<IcebergSession> = {}): IcebergSession => ({
  id: 'session-1',
  targetUserId: 'user-1',
  title: 'テストセッション',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  nodes: [],
  links: [],
  logs: [],
  status: 'active',
  ...overrides,
});

const n = (id: string, type: IcebergNode['type'], label: string, x = 0, y = 0): IcebergNode => ({
  id, type, label, position: { x, y }, status: 'hypothesis',
});

const l = (id: string, sourceNodeId: string, targetNodeId: string, confidence: HypothesisLink['confidence']): HypothesisLink => ({
  id, sourceNodeId, targetNodeId, confidence, status: 'hypothesis',
});

describe('icebergToInterventionDrafts', () => {
  it('ノードもリンクもない場合 → 空配列', () => {
    const session = createSession();
    expect(icebergToInterventionDrafts(session)).toEqual([]);
  });

  it('行動ノードのみ（リンクなし）→ 空triggerFactorsのDraft', () => {
    const session = createSession({
      nodes: [n('n-beh-1', 'behavior', '他害(叩く)')],
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
        n('n-beh-1', 'behavior', '離席'),
        n('n-asm-1', 'assessment', '聴覚過敏', 0, 300),
        n('n-env-1', 'environment', '工事騒音', 100, 300),
      ],
      links: [
        l('link-1', 'n-asm-1', 'n-beh-1', 'high'),
        l('link-2', 'n-env-1', 'n-beh-1', 'medium'),
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
        n('n-beh-1', 'behavior', '他害'),
        n('n-beh-2', 'behavior', 'パニック', 200),
        n('n-asm-1', 'assessment', '触覚鈍麻', 0, 300),
      ],
      links: [
        l('link-1', 'n-asm-1', 'n-beh-1', 'high'),
        l('link-2', 'n-asm-1', 'n-beh-2', 'low'),
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
      nodes: [n('n-asm-1', 'assessment', '聴覚過敏', 0, 300)],
    });
    expect(icebergToInterventionDrafts(session)).toEqual([]);
  });

  it('リンク先ノードが存在しない → スキップされる', () => {
    const session = createSession({
      nodes: [n('n-beh-1', 'behavior', '他害')],
      links: [l('link-1', 'n-missing', 'n-beh-1', 'high')],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result).toHaveLength(1);
    expect(result[0].triggerFactors).toHaveLength(0);
  });

  it('重複リンクは1つにまとめられる', () => {
    const session = createSession({
      nodes: [
        n('n-beh-1', 'behavior', '離席'),
        n('n-asm-1', 'assessment', '聴覚過敏', 0, 300),
      ],
      links: [
        l('link-1', 'n-asm-1', 'n-beh-1', 'high'),
        l('link-2', 'n-asm-1', 'n-beh-1', 'medium'),
      ],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result[0].triggerFactors).toHaveLength(1);
  });

  it('逆方向リンク（行動→要因）も正しく処理される', () => {
    const session = createSession({
      nodes: [
        n('n-beh-1', 'behavior', '自傷'),
        n('n-env-1', 'environment', '予定変更', 0, 300),
      ],
      links: [l('link-1', 'n-beh-1', 'n-env-1', 'high')],
    });
    const result = icebergToInterventionDrafts(session);

    expect(result).toHaveLength(1);
    expect(result[0].triggerFactors).toEqual([{ label: '予定変更', nodeId: 'n-env-1' }]);
  });
});
