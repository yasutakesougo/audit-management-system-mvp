/**
 * CallLog Domain Schema
 *
 * 電話・連絡受付ログのドメイン型定義。
 * Zod を SSOT とし、型は全て infer で導出する。
 *
 * 設計方針:
 * - 支援記録と分離した独立ドメイン
 * - status / urgency は enum で表現し、画面フィルタや集計の基軸とする
 * - CreateCallLogInput は作成時に受け付けるフィールドのみ明示
 *   (status・receivedByName はアプリ側で付与するため入力に含めない)
 */

import { z } from 'zod';

// ─── 値集合 ──────────────────────────────────────────────────────────────────

/** 対応状況 */
export const CallLogStatusSchema = z.enum(['new', 'callback_pending', 'done']);
export type CallLogStatus = z.infer<typeof CallLogStatusSchema>;

/** 緊急度 */
export const CallLogUrgencySchema = z.enum(['normal', 'today', 'urgent']);
export type CallLogUrgency = z.infer<typeof CallLogUrgencySchema>;

// ─── ドメインモデル ───────────────────────────────────────────────────────────

export const CallLogSchema = z.object({
  id: z.string(),

  /** 受電日時 (ISO 8601) */
  receivedAt: z.string(),

  /** 発信者名 */
  callerName: z.string().min(1),

  /** 発信者所属 */
  callerOrg: z.string().optional(),

  /** 対象担当者名 */
  targetStaffName: z.string().min(1),

  /** 受付者名（ログイン中ユーザーから付与） */
  receivedByName: z.string().min(1),

  /** 件名 */
  subject: z.string().min(1),

  /** 用件・メモ本文 */
  message: z.string().min(1),

  /** 折返し要否 */
  needCallback: z.boolean(),

  /** 緊急度 */
  urgency: CallLogUrgencySchema,

  /** 対応状況 */
  status: CallLogStatusSchema,

  /** 関連利用者 ID（省略可） */
  relatedUserId: z.string().optional(),

  /** 関連利用者名（省略可） */
  relatedUserName: z.string().optional(),

  /** 折返し期限 (ISO 8601, 省略可) */
  callbackDueAt: z.string().optional(),

  /** 完了日時 (ISO 8601, 省略可) */
  completedAt: z.string().optional(),

  /** 作成日時 (ISO 8601) */
  createdAt: z.string(),

  /** 更新日時 (ISO 8601) */
  updatedAt: z.string(),
});

export type CallLog = z.infer<typeof CallLogSchema>;

// ─── 作成入力 ────────────────────────────────────────────────────────────────

/**
 * 作成フォームで受け取るフィールドのみ。
 * status は 'new' に固定、receivedByName はログインユーザーから付与するため
 * 入力型に含めない。
 */
export const CreateCallLogInputSchema = z.object({
  /** 省略した場合は現在日時をアプリ側で補完する */
  receivedAt: z.string().optional(),
  callerName: z.string().min(1),
  callerOrg: z.string().optional(),
  targetStaffName: z.string().min(1),
  subject: z.string().min(1),
  message: z.string().min(1),
  needCallback: z.boolean(),
  urgency: CallLogUrgencySchema.optional(),
  relatedUserId: z.string().optional(),
  relatedUserName: z.string().optional(),
  callbackDueAt: z.string().optional(),
});

export type CreateCallLogInput = z.infer<typeof CreateCallLogInputSchema>;

// ─── 純粋ヘルパー関数 ─────────────────────────────────────────────────────────

/** 未対応ログかどうか（完了以外を "開いている" とみなす） */
export function isOpenCallLog(log: CallLog): boolean {
  return log.status !== 'done';
}

/** 緊急ログかどうか */
export function isUrgentCallLog(log: CallLog): boolean {
  return log.urgency === 'urgent';
}

/** 今日中対応が必要なログかどうか（urgent + today の両方） */
export function isTodayOrUrgentCallLog(log: CallLog): boolean {
  return log.urgency === 'urgent' || log.urgency === 'today';
}

/** 折返し待ちかつ折返し期限を過ぎているか */
export function isCallbackOverdue(log: CallLog, now = new Date()): boolean {
  if (log.status !== 'callback_pending') return false;
  if (!log.callbackDueAt) return false;
  return new Date(log.callbackDueAt) < now;
}

// ─── 集計ヘルパー（Today 連携用） ────────────────────────────────────────────

/** 未対応件数（status が done 以外） */
export function countOpenCallLogs(logs: CallLog[]): number {
  return logs.filter(isOpenCallLog).length;
}

/** 至急かつ未対応の件数 */
export function countUrgentOpenCallLogs(logs: CallLog[]): number {
  return logs.filter((l) => isOpenCallLog(l) && isUrgentCallLog(l)).length;
}

/** 折返し待ち件数（status === 'callback_pending'） */
export function countCallbackPendingCallLogs(logs: CallLog[]): number {
  return logs.filter((l) => l.status === 'callback_pending').length;
}

/**
 * 自分宛かつ未対応件数
 *
 * - `myName` が空のときは安全に 0 を返す
 * - `targetStaffName` との比較は trim() で空白事故を防ぐ
 */
export function countMyOpenCallLogs(logs: CallLog[], myName: string): number {
  if (!myName.trim()) return 0;
  return logs.filter(
    (l) => isOpenCallLog(l) && l.targetStaffName?.trim() === myName.trim(),
  ).length;
}

/**
 * 折返し期限超過件数
 *
 * - status が 'callback_pending' かつ callbackDueAt < now のログを対象とする
 * - `now` はテストで注入可能（省略時は現在時刻）
 */
export function countOverdueCallLogs(logs: CallLog[], now = new Date()): number {
  return logs.filter((l) => isCallbackOverdue(l, now)).length;
}
