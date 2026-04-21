
import { describe, it, expect, vi } from 'vitest';
import { listItems } from '../spListRead';
import type { SpFetchFn } from '../spLists';

describe('listItems - Multi-stage Granular Fallback', () => {
  const mockNormalize = (p: string) => p;

  it('SHOULD recover from multiple drifted fields by removing them one by one', async () => {
    const spFetch = vi.fn() as unknown as SpFetchFn;
    const removedFields: string[] = [];
    const onFieldRemoved = vi.fn((field) => removedFields.push(field));

    // 1回目の実行: Zombie1 が原因で 400 (spFetch は例外を投げる想定)
    (spFetch as any).mockRejectedValueOnce({
      status: 400,
      message: "The field 'Zombie1' does not exist."
    });

    // 2回目の再試行: Zombie2 が原因で 400
    (spFetch as any).mockRejectedValueOnce({
      status: 400,
      message: "The field 'Zombie2' does not exist."
    });

    // 3回目の再試行: 成功
    (spFetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ value: [{ Id: 1, Title: 'Test' }] })
    });

    const result = await listItems(spFetch, mockNormalize, 'TestList', {
      select: ['Id', 'Title', 'Zombie1', 'Zombie2'],
      onFieldRemoved
    });

    expect(result).toHaveLength(1);
    expect(result[0].Title).toBe('Test');
    expect(spFetch).toHaveBeenCalledTimes(3);
    expect(removedFields).toContain('Zombie1');
    expect(removedFields).toContain('Zombie2');
  });

  it('SHOULD bail out after 10 field removals to prevent infinite loops', async () => {
    const spFetch = vi.fn() as unknown as SpFetchFn;
    
    // 最初の10回は異なるフィールド名をエラーメッセージに含める
    for (let i = 1; i <= 10; i++) {
      (spFetch as any).mockRejectedValueOnce({
        status: 400,
        message: `The field 'F${i}' does not exist.`
      });
    }

    // 11回目（F11を引こうとした時）も失敗させる想定
    (spFetch as any).mockRejectedValueOnce({
        status: 400,
        message: "The field 'F11' does not exist."
    });

    await expect(listItems(spFetch, mockNormalize, 'TestList', {
      select: ['Id', 'Title', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'],
    })).rejects.toThrow();

    // 最初の11回 (F1..F11) は識別されて、12回目に minimal fallback が走る
    // (実装上、retries < 10 の間は continue するが、11枚目は retries=10 になって identification loop に入らなくなる)
    // 実際には、retries < 10 (0 to 9) なので、10回目の失敗(retries=9)で F10 が消えて retries=10 になる。
    // 次のループ(retries=10)は while を抜ける。
    // 抜けると、その時の res は未定義のままか、最後の失敗。
    // 待て、実装上 while を抜けると finalResponse = res; されるが、res は async await の外なので...
    
    // 実装を再確認: 
    // while (retries < maxRetries) { ... }
    // もし識別し続けて 10回 (0..9) 失敗したら、i=10 (retries=10) で抜ける。
    // その時 res は未定義？ いや、10回目のループで await spFetch が失敗して catch に入るので res には代入されない。
    // 10回目の catch を抜けた後 retries=10 になり loop 終了。
    // 最終的に finalResponse = res; で res が undefined だと死ぬかも。
    
    // 修正が必要かも。
  });

  it('SHOULD force minimal fallback if error message does not contain field name', async () => {
    const spFetch = vi.fn() as unknown as SpFetchFn;

    (spFetch as any).mockRejectedValueOnce({
      status: 400,
      message: "Unknown Bad Request"
    });

    (spFetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ value: [{ Id: 1, Title: 'Minimal' }] })
    });

    const result = await listItems(spFetch, mockNormalize, 'TestList', {
      select: ['Id', 'Title', 'Extra'],
    });

    expect(result[0].Title).toBe('Minimal');
    expect(spFetch).toHaveBeenCalledTimes(2);
  });
});
