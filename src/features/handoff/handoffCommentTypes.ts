/**
 * 申し送りコメント（返信）型定義
 *
 * Handoff_Timeline の各レコードに紐づくスレッド型コメント。
 * SharePoint リスト: Handoff_Comments
 */

// ────────────────────────────────────────────────────────────
// TypeScript 型定義
// ────────────────────────────────────────────────────────────

/**
 * コメント（返信）レコード
 */
export interface HandoffComment {
  id: number;
  /** 親の申し送り ID */
  handoffId: number;
  /** コメント本文 */
  body: string;
  /** 作成者名 */
  authorName: string;
  /** 作成者メール/アカウント */
  authorAccount: string;
  /** 作成日時 (ISO) */
  createdAt: string;
}

/**
 * 新規コメント作成用入力
 */
export interface NewCommentInput {
  handoffId: number;
  body: string;
  authorName: string;
  authorAccount: string;
}

// ────────────────────────────────────────────────────────────
// SharePoint 型定義
// ────────────────────────────────────────────────────────────

/**
 * SharePoint コメントアイテム
 */
export interface SpHandoffCommentItem {
  Id: number;
  HandoffId: number;
  Body: string;
  AuthorName: string;
  AuthorAccount: string;
  Created?: string;
}

/**
 * SP → 内部型変換
 */
export function fromSpCommentItem(sp: SpHandoffCommentItem): HandoffComment {
  return {
    id: sp.Id,
    handoffId: sp.HandoffId,
    body: sp.Body,
    authorName: sp.AuthorName,
    authorAccount: sp.AuthorAccount,
    createdAt: sp.Created || new Date().toISOString(),
  };
}

/**
 * 内部型 → SP作成ペイロード変換
 */
export function toSpCommentCreatePayload(
  input: NewCommentInput
): Omit<SpHandoffCommentItem, 'Id' | 'Created'> {
  return {
    HandoffId: input.handoffId,
    Body: input.body,
    AuthorName: input.authorName,
    AuthorAccount: input.authorAccount,
  };
}
