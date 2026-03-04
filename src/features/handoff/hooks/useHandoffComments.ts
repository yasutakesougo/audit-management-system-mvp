/**
 * useHandoffComments — 楽観的更新対応コメント管理フック
 *
 * handoffCommentApi をラップし、以下を提供:
 * - コメント一覧の取得（初回自動ロード）
 * - 楽観的更新による即レスポンス送信
 * - 送信失敗時のロールバック + エラーメッセージ
 * - 削除時の楽観的更新
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useHandoffCommentApi } from '../handoffCommentApi';
import type { HandoffComment, NewCommentInput } from '../handoffCommentTypes';

// ── 楽観的コメント用の一時 ID 範囲 ──
let optimisticCounter = -1;
function nextOptimisticId(): number {
  return optimisticCounter--;
}

export interface UseHandoffCommentsReturn {
  comments: HandoffComment[];
  loading: boolean;
  error: string | null;
  addComment: (input: Omit<NewCommentInput, 'handoffId'>) => Promise<void>;
  deleteComment: (commentId: number) => Promise<void>;
  commentCount: number;
}

export function useHandoffComments(handoffId: number): UseHandoffCommentsReturn {
  const api = useHandoffCommentApi();
  const [comments, setComments] = useState<HandoffComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // ── Cleanup ──
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── 初回自動ロード ──
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getComments(handoffId);
        if (!cancelled && mountedRef.current) {
          setComments(result);
        }
      } catch (e) {
        if (!cancelled && mountedRef.current) {
          setError(e instanceof Error ? e.message : 'コメント取得に失敗しました');
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [api, handoffId]);

  // ── 楽観的更新による即レスポンス送信 ──
  const addComment = useCallback(
    async (input: Omit<NewCommentInput, 'handoffId'>) => {
      const optimisticId = nextOptimisticId();
      const optimistic: HandoffComment = {
        id: optimisticId,
        handoffId,
        body: input.body,
        authorName: input.authorName,
        authorAccount: input.authorAccount,
        createdAt: new Date().toISOString(),
      };

      // 1) 即座に UI 反映
      setComments((prev) => [...prev, optimistic]);
      setError(null);

      try {
        // 2) バックエンドに送信
        const saved = await api.addComment({ ...input, handoffId });

        // 3) 楽観的 → 実体に差し替え
        if (mountedRef.current) {
          setComments((prev) =>
            prev.map((c) => (c.id === optimisticId ? saved : c)),
          );
        }
      } catch (e) {
        // 4) 失敗時はロールバック
        if (mountedRef.current) {
          setComments((prev) => prev.filter((c) => c.id !== optimisticId));
          setError(e instanceof Error ? e.message : 'コメント送信に失敗しました');
        }
        throw e;
      }
    },
    [api, handoffId],
  );

  // ── 楽観的削除 ──
  const deleteComment = useCallback(
    async (commentId: number) => {
      // スナップショット保存
      const snapshot = comments;
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      try {
        await api.deleteComment(commentId, handoffId);
      } catch (e) {
        // ロールバック
        if (mountedRef.current) {
          setComments(snapshot);
          setError(e instanceof Error ? e.message : 'コメント削除に失敗しました');
        }
        throw e;
      }
    },
    [api, handoffId, comments],
  );

  return {
    comments,
    loading,
    error,
    addComment,
    deleteComment,
    commentCount: comments.length,
  };
}
