/**
 * 申し送り更新履歴（監査ログ）型定義
 *
 * ステータス変更やフィールド更新の追跡記録。
 * SharePoint リスト: Handoff_AuditLog
 */

import type { HandoffStatus } from './handoffTypes';

// ────────────────────────────────────────────────────────────
// TypeScript 型定義
// ────────────────────────────────────────────────────────────

/** 変更対象フィールド */
export type AuditFieldName =
  | 'status'
  | 'severity'
  | 'category'
  | 'message'
  | 'title'
  | 'carryOverDate';

/** 変更アクション種別 */
export type AuditAction =
  | 'created'          // 新規作成
  | 'status_changed'   // ステータス変更
  | 'field_updated'    // フィールド更新
  | 'comment_added';   // コメント追加

/**
 * 監査ログレコード
 */
export interface HandoffAuditLog {
  id: number;
  /** 対象の申し送り ID */
  handoffId: number;
  /** アクション種別 */
  action: AuditAction;
  /** 変更フィールド名（status_changed / field_updated 時） */
  fieldName?: AuditFieldName;
  /** 変更前の値 */
  oldValue?: string;
  /** 変更後の値 */
  newValue?: string;
  /** 操作者名 */
  changedBy: string;
  /** 操作者アカウント */
  changedByAccount: string;
  /** 操作日時 (ISO) */
  changedAt: string;
}

/**
 * 新規監査ログ作成用入力
 */
export interface NewAuditLogInput {
  handoffId: number;
  action: AuditAction;
  fieldName?: AuditFieldName;
  oldValue?: string;
  newValue?: string;
  changedBy: string;
  changedByAccount: string;
}

// ────────────────────────────────────────────────────────────
// SharePoint 型定義
// ────────────────────────────────────────────────────────────

export interface SpHandoffAuditLogItem {
  Id: number;
  HandoffId: number;
  Action: string;
  FieldName?: string;
  OldValue?: string;
  NewValue?: string;
  ChangedBy: string;
  ChangedByAccount: string;
  Created?: string;
}

/**
 * SP → 内部型変換
 */
export function fromSpAuditLogItem(sp: SpHandoffAuditLogItem): HandoffAuditLog {
  return {
    id: sp.Id,
    handoffId: sp.HandoffId,
    action: sp.Action as AuditAction,
    fieldName: sp.FieldName as AuditFieldName | undefined,
    oldValue: sp.OldValue,
    newValue: sp.NewValue,
    changedBy: sp.ChangedBy,
    changedByAccount: sp.ChangedByAccount,
    changedAt: sp.Created || new Date().toISOString(),
  };
}

/**
 * 内部型 → SP作成ペイロード変換
 */
export function toSpAuditLogCreatePayload(
  input: NewAuditLogInput
): Omit<SpHandoffAuditLogItem, 'Id' | 'Created'> {
  return {
    HandoffId: input.handoffId,
    Action: input.action,
    FieldName: input.fieldName,
    OldValue: input.oldValue,
    NewValue: input.newValue,
    ChangedBy: input.changedBy,
    ChangedByAccount: input.changedByAccount,
  };
}

// ────────────────────────────────────────────────────────────
// 表示用メタデータ
// ────────────────────────────────────────────────────────────

/** アクション表示用ラベルとアイコン */
export const AUDIT_ACTION_META: Record<AuditAction, { label: string; icon: string }> = {
  created: { label: '作成', icon: '🆕' },
  status_changed: { label: 'ステータス変更', icon: '🔄' },
  field_updated: { label: '内容変更', icon: '✏️' },
  comment_added: { label: 'コメント追加', icon: '💬' },
};

/** フィールド名の日本語表示 */
export const AUDIT_FIELD_LABELS: Record<AuditFieldName, string> = {
  status: 'ステータス',
  severity: '重要度',
  category: 'カテゴリ',
  message: '本文',
  title: 'タイトル',
  carryOverDate: '持越日付',
};

/**
 * 監査ログから人間が読みやすい説明文を生成
 */
export function formatAuditDescription(log: HandoffAuditLog): string {
  switch (log.action) {
    case 'created':
      return `${log.changedBy} が申し送りを作成しました`;
    case 'status_changed':
      return `${log.changedBy} がステータスを「${log.oldValue ?? '—'}」→「${log.newValue ?? '—'}」に変更しました`;
    case 'field_updated': {
      const fieldLabel = log.fieldName
        ? AUDIT_FIELD_LABELS[log.fieldName] || log.fieldName
        : '不明';
      return `${log.changedBy} が${fieldLabel}を変更しました`;
    }
    case 'comment_added':
      return `${log.changedBy} がコメントを追加しました`;
    default:
      return `${log.changedBy} が操作を行いました`;
  }
}

/**
 * ステータスの遷移説明を生成（状態マシン対応）
 */
export function formatStatusTransition(
  oldStatus: HandoffStatus | string | undefined,
  newStatus: HandoffStatus | string | undefined
): string {
  if (!oldStatus && newStatus) return `→ ${newStatus}`;
  if (oldStatus && !newStatus) return `${oldStatus} →`;
  return `${oldStatus} → ${newStatus}`;
}
