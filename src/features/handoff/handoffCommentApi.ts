/**
 * 申し送りコメント（返信）API
 *
 * localStorage / SharePoint 切り替え対応。
 * handoffConfig.storage の値に応じて動作モード変更。
 */

import { useCallback, useMemo, useState } from 'react';
import { auditLog } from '../../lib/debugLogger';
import type { UseSP } from '../../lib/spClient';
import { useSP } from '../../lib/spClient';
import type { HandoffComment, NewCommentInput, SpHandoffCommentItem } from './handoffCommentTypes';
import { fromSpCommentItem, toSpCommentCreatePayload } from './handoffCommentTypes';
import { handoffConfig } from './handoffConfig';
import { toErrorMessage } from './handoffLoggerUtils';

// ────────────────────────────────────────────────────────────
// localStorage ストレージ
// ────────────────────────────────────────────────────────────

const COMMENT_STORAGE_KEY = 'handoff.comments.dev.v1';

type CommentStorageShape = Record<string, HandoffComment[]>; // key = handoffId

function loadCommentStorage(): CommentStorageShape {
  try {
    const raw = window.localStorage.getItem(COMMENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CommentStorageShape) : {};
  } catch {
    return {};
  }
}

function saveCommentStorage(data: CommentStorageShape): void {
  try {
    window.localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    auditLog.warn('handoff', 'comment.storage_save_failed');
  }
}

function generateLocalId(): number {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return parseInt(crypto.randomUUID().replace(/-/g, '').slice(0, 8), 16);
  }
  return Date.now() + Math.floor(Math.random() * 1000);
}

// ────────────────────────────────────────────────────────────
// コメント API クラス
// ────────────────────────────────────────────────────────────

const SP_COMMENT_LIST_TITLE = 'Handoff_Comments';

class HandoffCommentApi {
  private sp: UseSP;

  constructor(sp: UseSP) {
    this.sp = sp;
  }

  /**
   * 指定申し送りのコメント一覧を取得
   */
  async getComments(handoffId: number): Promise<HandoffComment[]> {
    if (handoffConfig.storage !== 'sharepoint') {
      return this.getCommentsLocal(handoffId);
    }
    return this.getCommentsSP(handoffId);
  }

  /**
   * コメントを追加
   */
  async addComment(input: NewCommentInput): Promise<HandoffComment> {
    if (handoffConfig.storage !== 'sharepoint') {
      return this.addCommentLocal(input);
    }
    return this.addCommentSP(input);
  }

  /**
   * コメントを削除
   */
  async deleteComment(commentId: number, handoffId: number): Promise<void> {
    if (handoffConfig.storage !== 'sharepoint') {
      return this.deleteCommentLocal(commentId, handoffId);
    }
    return this.deleteCommentSP(commentId);
  }

  /**
   * 複数の申し送りIDに対するコメント件数を一括取得
   */
  async getCommentCounts(handoffIds: number[]): Promise<Record<number, number>> {
    if (handoffConfig.storage !== 'sharepoint') {
      return this.getCommentCountsLocal(handoffIds);
    }
    return this.getCommentCountsSP(handoffIds);
  }

  // ── localStorage 実装 ──

  private getCommentsLocal(handoffId: number): HandoffComment[] {
    const data = loadCommentStorage();
    return (data[String(handoffId)] ?? []).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  private addCommentLocal(input: NewCommentInput): HandoffComment {
    const data = loadCommentStorage();
    const key = String(input.handoffId);
    const comment: HandoffComment = {
      id: generateLocalId(),
      handoffId: input.handoffId,
      body: input.body,
      authorName: input.authorName,
      authorAccount: input.authorAccount,
      createdAt: new Date().toISOString(),
    };
    data[key] = [...(data[key] ?? []), comment];
    saveCommentStorage(data);
    return comment;
  }

  private deleteCommentLocal(commentId: number, handoffId: number): void {
    const data = loadCommentStorage();
    const key = String(handoffId);
    data[key] = (data[key] ?? []).filter(c => c.id !== commentId);
    saveCommentStorage(data);
  }

  private getCommentCountsLocal(handoffIds: number[]): Record<number, number> {
    const data = loadCommentStorage();
    const result: Record<number, number> = {};
    for (const id of handoffIds) {
      result[id] = (data[String(id)] ?? []).length;
    }
    return result;
  }

  // ── SharePoint 実装 ──

  private async getCommentsSP(handoffId: number): Promise<HandoffComment[]> {
    const filter = `HandoffId eq ${handoffId}`;
    const query = `?$filter=${encodeURIComponent(filter)}&$orderby=Created asc`;
    const response = await this.sp.spFetch(
      `lists/getbytitle('${SP_COMMENT_LIST_TITLE}')/items${query}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.status}`);
    }
    const data = await response.json();
    const items: SpHandoffCommentItem[] = data.value || [];
    return items.map(fromSpCommentItem);
  }

  private async addCommentSP(input: NewCommentInput): Promise<HandoffComment> {
    const payload = toSpCommentCreatePayload(input);
    const response = await this.sp.spFetch(
      `lists/getbytitle('${SP_COMMENT_LIST_TITLE}')/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;odata=verbose' },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to create comment: ${response.status}`);
    }
    const result = await response.json();
    return fromSpCommentItem(result.d ?? result);
  }

  private async deleteCommentSP(commentId: number): Promise<void> {
    const response = await this.sp.spFetch(
      `lists/getbytitle('${SP_COMMENT_LIST_TITLE}')/items(${commentId})`,
      {
        method: 'DELETE',
        headers: { 'If-Match': '*' },
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to delete comment: ${response.status}`);
    }
  }

  private async getCommentCountsSP(handoffIds: number[]): Promise<Record<number, number>> {
    // ページング取得で List View Threshold (5000件制限) を回避
    const result: Record<number, number> = {};
    for (const id of handoffIds) {
      result[id] = 0;
    }

    if (handoffIds.length === 0) return result;

    const filterParts = handoffIds.map(id => `HandoffId eq ${id}`);
    const filter = filterParts.join(' or ');
    const PAGE_SIZE = 200;
    let nextUrl: string | null =
      `lists/getbytitle('${SP_COMMENT_LIST_TITLE}')/items?$select=Id,HandoffId&$filter=${encodeURIComponent(filter)}&$top=${PAGE_SIZE}`;

    try {
      while (nextUrl) {
        const response = await this.sp.spFetch(nextUrl);
        if (!response.ok) break;

        const data: {
          value?: { HandoffId: number }[];
          '@odata.nextLink'?: string;
          'd'?: { __next?: string; results?: { HandoffId: number }[] };
        } = await response.json();

        const items = data.value ?? data.d?.results ?? [];
        for (const item of items) {
          result[item.HandoffId] = (result[item.HandoffId] || 0) + 1;
        }

        // SharePoint REST API returns @odata.nextLink (nometadata) or d.__next (verbose)
        nextUrl = data['@odata.nextLink'] ?? data.d?.__next ?? null;
      }
    } catch (error) {
      auditLog.error('handoff', 'comment.get_counts_failed', { error: toErrorMessage(error) });
    }

    return result;
  }
}

// ────────────────────────────────────────────────────────────
// React Hook
// ────────────────────────────────────────────────────────────

export const useHandoffCommentApi = () => {
  const sp = useSP();
  return useMemo(() => new HandoffCommentApi(sp), [sp]);
};

/**
 * 申し送りコメント管理Hook
 */
export function useHandoffComments(handoffId: number) {
  const api = useHandoffCommentApi();
  const [comments, setComments] = useState<HandoffComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getComments(handoffId);
      setComments(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'コメント取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [api, handoffId]);

  const addComment = useCallback(async (input: Omit<NewCommentInput, 'handoffId'>) => {
    try {
      const newComment = await api.addComment({ ...input, handoffId });
      setComments(prev => [...prev, newComment]);
      return newComment;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'コメント追加に失敗しました');
      throw e;
    }
  }, [api, handoffId]);

  const deleteComment = useCallback(async (commentId: number) => {
    try {
      await api.deleteComment(commentId, handoffId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'コメント削除に失敗しました');
      throw e;
    }
  }, [api, handoffId]);

  return {
    comments,
    loading,
    error,
    loadComments,
    addComment,
    deleteComment,
    commentCount: comments.length,
  };
}
