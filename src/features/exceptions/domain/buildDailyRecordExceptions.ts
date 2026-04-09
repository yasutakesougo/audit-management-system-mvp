/**
 * buildDailyRecordExceptions
 *
 * 日々の記録未作成を「集約 parent + 個別 child」構造の ExceptionItem[] に変換する。
 * ExceptionCenter では parent を折りたたみ単位、child を個別対応単位として扱う。
 */

import type { DailyRecordSummary, ExceptionItem } from './exceptionLogic';
import { detectMissingRecords } from './exceptionLogic';

export type BuildDailyRecordExceptionsOptions = {
  expectedUsers: Array<{ userId: string; userName: string }>;
  existingRecords: DailyRecordSummary[];
  targetDate: string;
  maxChildrenPerParent?: number;
};

const DEFAULT_MAX_CHILDREN_PER_PARENT = 5;

function normalize(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildParentId(targetDate: string): string {
  return `daily-missing-record-${targetDate}`;
}

export function buildDailyRecordExceptions(
  options: BuildDailyRecordExceptionsOptions,
): ExceptionItem[] {
  const {
    expectedUsers,
    existingRecords,
    targetDate,
    maxChildrenPerParent = DEFAULT_MAX_CHILDREN_PER_PARENT,
  } = options;

  const missing = detectMissingRecords({
    expectedUsers,
    existingRecords,
    targetDate,
  });

  const normalizedChildren = missing
    .filter((item) => normalize(item.targetUserId) !== null)
    .sort((a, b) => (a.targetUser ?? '').localeCompare(b.targetUser ?? ''));

  const children = normalizedChildren.slice(0, maxChildrenPerParent);
  if (children.length === 0) return [];

  const parentId = buildParentId(targetDate);
  const hiddenCount = Math.max(0, normalizedChildren.length - children.length);
  const hiddenLabel = hiddenCount > 0 ? `（他 ${hiddenCount} 件）` : '';

  const parent: ExceptionItem = {
    id: parentId,
    category: 'missing-record',
    severity: 'high',
    title: `${targetDate} の日々の記録未作成`,
    description: `${children.length}名の日々の記録が未作成です。対象者ごとに作成してください。${hiddenLabel}`,
    targetDate,
    updatedAt: targetDate,
    actionLabel: '未入力一覧を確認',
    actionPath: `/daily/activity?date=${encodeURIComponent(targetDate)}`,
  };

  const childItems = children.map((item) => ({
    ...item,
    parentId,
    actionLabel: `${item.targetUser ?? '対象者'}の日々の記録を開く`,
    actionPath: item.targetUserId
      ? `/daily/activity?userId=${encodeURIComponent(item.targetUserId)}&date=${encodeURIComponent(targetDate)}`
      : item.actionPath,
  }));

  return [parent, ...childItems];
}
