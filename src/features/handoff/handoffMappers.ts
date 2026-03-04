/**
 * 申し送り SharePoint ↔ 内部型 マッパー関数
 *
 * SP REST API の JSON レスポンスを HandoffRecord に変換したり、
 * CRUD 用のペイロードを生成するユーティリティ。
 */

import { generateTitleFromMessage } from './generateTitleFromMessage';
import type {
    HandoffCategory,
    HandoffRecord,
    HandoffSeverity,
    HandoffStatus,
    NewHandoffInput,
    SpHandoffItem,
    TimeBand,
} from './handoffTypes';

// ────────────────────────────────────────────────────────────
// SP → 内部型
// ────────────────────────────────────────────────────────────

/** v3: 有効なステータス値の一覧（未知値のフォールバック検証用） */
const VALID_HANDOFF_STATUSES: readonly HandoffStatus[] = [
  '未対応', '対応中', '対応済', '確認済', '明日へ持越', '完了',
] as const;

/**
 * SharePoint アイテムを内部型に変換
 * v3: 未知の Status 値は '未対応' にフォールバック（前方互換）
 */
export function fromSpHandoffItem(sp: SpHandoffItem): HandoffRecord {
  const status = VALID_HANDOFF_STATUSES.includes(sp.Status as HandoffStatus)
    ? (sp.Status as HandoffStatus)
    : '未対応';

  return {
    id: sp.Id,
    title: sp.Title,
    message: sp.Message,
    userCode: sp.UserCode,
    userDisplayName: sp.UserDisplayName,
    category: sp.Category as HandoffCategory,
    severity: sp.Severity as HandoffSeverity,
    status,
    timeBand: sp.TimeBand as TimeBand,
    meetingSessionKey: sp.MeetingSessionKey,
    sourceType: sp.SourceType,
    sourceId: sp.SourceId,
    sourceUrl: sp.SourceUrl,
    sourceKey: sp.SourceKey,
    sourceLabel: sp.SourceLabel,
    createdAt: sp.CreatedAt || sp.Created || new Date().toISOString(),
    createdByName: sp.CreatedByName,
    isDraft: sp.IsDraft,
    carryOverDate: sp.CarryOverDate,
  };
}

// ────────────────────────────────────────────────────────────
// 内部型 → SP (Create / Update ペイロード)
// ────────────────────────────────────────────────────────────

/** 内部型を SharePoint 作成用ペイロードに変換 */
export function toSpHandoffCreatePayload(
  record: NewHandoffInput & {
    title?: string;
    createdAt?: string;
    createdByName?: string;
    isDraft?: boolean;
  }
): Omit<SpHandoffItem, 'Id' | 'Created' | 'Modified' | 'AuthorId' | 'EditorId'> {
  return {
    Title: record.title || generateTitleFromMessage(record.message),
    Message: record.message,
    UserCode: record.userCode,
    UserDisplayName: record.userDisplayName,
    Category: record.category,
    Severity: record.severity,
    Status: '未対応', // 新規作成時は常に未対応
    TimeBand: record.timeBand,
    MeetingSessionKey: record.meetingSessionKey,
    SourceType: record.sourceType,
    SourceId: record.sourceId,
    SourceUrl: record.sourceUrl,
    SourceKey: record.sourceKey,
    SourceLabel: record.sourceLabel,
    CreatedAt: record.createdAt || new Date().toISOString(),
    CreatedByName: record.createdByName || 'システム利用者',
    IsDraft: record.isDraft || false,
  };
}

/** SharePoint 更新用ペイロード（部分更新対応） */
export function toSpHandoffUpdatePayload(
  updates: Partial<Pick<HandoffRecord, 'status' | 'severity' | 'category' | 'message' | 'title' | 'carryOverDate'>>
): Partial<Pick<SpHandoffItem, 'Status' | 'Severity' | 'Category' | 'Message' | 'Title' | 'CarryOverDate'>> {
  const payload: Partial<Pick<SpHandoffItem, 'Status' | 'Severity' | 'Category' | 'Message' | 'Title' | 'CarryOverDate'>> = {};

  if (updates.status !== undefined) payload.Status = updates.status;
  if (updates.severity !== undefined) payload.Severity = updates.severity;
  if (updates.category !== undefined) payload.Category = updates.category;
  if (updates.message !== undefined) payload.Message = updates.message;
  if (updates.title !== undefined) payload.Title = updates.title;
  if (updates.carryOverDate !== undefined) payload.CarryOverDate = updates.carryOverDate;

  return payload;
}
