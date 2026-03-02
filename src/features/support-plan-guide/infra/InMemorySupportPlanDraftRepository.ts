import type {
    SupportPlanDraftRepository,
    SupportPlanListParams,
} from '../domain/SupportPlanDraftRepository';
import type { SupportPlanDraft } from '../types';
import { createDraft } from '../utils/helpers';

// ────────────────────────────────────────────────────────────────────────────
// InMemory Implementation
// ────────────────────────────────────────────────────────────────────────────

/**
 * In-memory implementation of SupportPlanDraftRepository.
 *
 * Used in:
 * - Development mode (no SharePoint access)
 * - Demo / offline mode
 * - Unit testing
 *
 * Seeds with a single empty draft on construction.
 */
class InMemorySupportPlanDraftRepositoryImpl implements SupportPlanDraftRepository {
  private store = new Map<string, SupportPlanDraft>();

  constructor() {
    const seed = createDraft('利用者 1');
    this.store.set(seed.id, seed);
  }

  async listDrafts(params?: SupportPlanListParams): Promise<SupportPlanDraft[]> {
    params?.signal?.throwIfAborted();

    let results = Array.from(this.store.values());

    if (params?.userCode) {
      results = results.filter((d) => d.userCode === params.userCode);
    }

    if (params?.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      // In-memory drafts don't have an explicit status field on the domain type yet;
      // all in-memory items are treated as 'draft' unless extended.
      // For now, return all if 'draft' is in the filter, else none.
      if (!statuses.includes('draft')) {
        return [];
      }
    }

    return results.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  async saveDraft(draft: SupportPlanDraft): Promise<void> {
    this.store.set(draft.id, { ...draft });
  }

  async deleteDraft(draftId: string): Promise<void> {
    this.store.delete(draftId);
  }

  async bulkSave(drafts: SupportPlanDraft[]): Promise<void> {
    for (const draft of drafts) {
      this.store.set(draft.id, { ...draft });
    }
  }

  // ── Test helpers ──

  /** Get current store size (for testing). */
  get size(): number {
    return this.store.size;
  }

  /** Clear all data (for testing). */
  clear(): void {
    this.store.clear();
  }
}

// ── Singleton export ──
export const inMemorySupportPlanDraftRepository = new InMemorySupportPlanDraftRepositoryImpl();

/** Factory function for creating fresh instances (useful in tests). */
export const createInMemorySupportPlanDraftRepository = (): InMemorySupportPlanDraftRepositoryImpl =>
  new InMemorySupportPlanDraftRepositoryImpl();
