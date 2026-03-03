import type { SupportPlanDraft } from '../types';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Filter parameters for listing support plans. */
export type SupportPlanListParams = {
  /** Restrict results to a specific user. */
  userCode?: string;
  /** Restrict results to specific status(es). */
  status?: SupportPlanStatus | SupportPlanStatus[];
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
};

/**
 * Lifecycle status for a support plan.
 *
 * - `draft`     : 作成中（アセスメント～原案）
 * - `confirmed` : 確定済み（同意取得後の本案）
 * - `obsolete`  : 過去履歴（期間終了 or 新版作成後）
 */
export type SupportPlanStatus = 'draft' | 'confirmed' | 'obsolete';

// ────────────────────────────────────────────────────────────────────────────
// Repository Interface
// ────────────────────────────────────────────────────────────────────────────

/**
 * Support Plan Draft Repository Interface
 *
 * Abstracts support plan data access following the Repository Pattern.
 * Implementations: SharePointSupportPlanDraftRepository, InMemorySupportPlanDraftRepository
 *
 * Data Model:
 * - Each item represents one draft/plan for a specific user
 * - Form data (17 fields) is stored as serialised JSON
 * - Status tracks the plan lifecycle: draft → confirmed → obsolete
 */
export interface SupportPlanDraftRepository {
  /**
   * List drafts, optionally filtered by user code and/or status.
   *
   * @returns Array of SupportPlanDraft, sorted by createdAt ascending.
   */
  listDrafts(params?: SupportPlanListParams): Promise<SupportPlanDraft[]>;

  /**
   * Save (create or update) a single draft.
   * The implementation determines upsert strategy (by draftId).
   */
  saveDraft(draft: SupportPlanDraft): Promise<void>;

  /**
   * Delete a draft by its client-side draftId.
   */
  deleteDraft(draftId: string): Promise<void>;

  /**
   * Bulk-save multiple drafts.
   * Primarily used for the initial migration from localStorage.
   */
  bulkSave(drafts: SupportPlanDraft[]): Promise<void>;
}
