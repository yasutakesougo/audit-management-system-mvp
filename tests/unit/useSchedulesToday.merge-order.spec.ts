import { mergeById } from '@/features/schedule/merge';
import { describe, expect, it } from 'vitest';

describe('mergeById', () => {
  it('Fetched より LocalDraft が優先される', () => {
    const fetched = [{ id: 'a', status: '確定', title: 'x' }];
    const drafts = [{ id: 'a', status: '遅刻', title: 'x' }];
    const merged = mergeById(fetched, drafts);
    expect(merged.find((record) => record.id === 'a')?.status).toMatch(/遅刻|late/);
  });
});
