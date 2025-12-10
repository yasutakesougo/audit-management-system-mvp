/**
 * IntegratedResourceCalendar Business Logic Utilities
 *
 * テスト可能な純粋関数として分離したロジック。
 * FullCalendar依存を最小化し、単体テストで検証可能にする。
 */
import type { EventApi } from '@fullcalendar/core';

/**
 * リソース警告情報
 */
export interface ResourceWarning {
  totalHours: number;
  isOver: boolean;
}

/**
 * イベントドロップ・移動の許可判定に必要な情報
 */
export interface EventDropInfo {
  start: Date;
  end: Date;
  resourceId?: string;
}

/**
 * FullCalendar EventAPI の抽象化（テスト用）
 */
export interface TestableEvent {
  id: string;
  start: Date | null;
  end: Date | null;
  display?: string;
  extendedProps: {
    actualStart?: string;
    resourceId?: string;
    [key: string]: unknown;
  };
  getResources(): Array<{ id: string }>;
}

/**
 * 指定リソース・時間帯での重複イベント存在チェック（共通関数）
 *
 * @param events チェック対象のイベント一覧
 * @param targetResourceId 対象リソースID
 * @param start 開始時刻
 * @param end 終了時刻
 * @param ignoreId 無視するイベントID（ドロップ時の自分自身など）
 * @returns 重複があるかどうか
 */
function hasOverlapOnResource(
  events: TestableEvent[],
  targetResourceId: string,
  start: Date,
  end: Date,
  ignoreId?: string,
): boolean {
  return events.some((e) => {
    // 自分自身は無視
    if (ignoreId && e.id === ignoreId) return false;
    // 背景イベント（警告用など）は無視
    if (e.display === 'background') return false;

    const eventResourceId =
      e.getResources()[0]?.id ?? e.extendedProps?.resourceId;

    if (eventResourceId !== targetResourceId) return false;

    const eStart = e.start;
    const eEnd = e.end;

    if (!eStart || !eEnd) return false;

    // [start, end) が既存イベントと重なっているか（半開区間）
    return start < eEnd && end > eStart;
  });
}

/**
 * Issue 8: イベントドロップ可能性判定（純粋関数版）
 *
 * @param draggedEvent - ドラッグされているイベント
 * @param dropInfo - ドロップ先の情報
 * @param allEvents - カレンダー上の全イベント
 * @returns 許可するかどうかとエラーメッセージ
 */
export function checkEventDropAllowed(
  draggedEvent: TestableEvent,
  dropInfo: EventDropInfo,
  allEvents: TestableEvent[],
): { allowed: boolean; message?: string } {
  const { start, end } = dropInfo;

  // 0) 異常な時間範囲をガード
  if (start >= end) {
    return {
      allowed: false,
      message: '開始時刻は終了時刻より前である必要があります。',
    };
  }

  // 1) 実績があるイベントは編集禁止
  if (draggedEvent.extendedProps.actualStart) {
    return {
      allowed: false,
      message: '実績が登録されている予定は編集できません。',
    };
  }

  // 対象リソースID（ドロップ先が優先／なければイベントに紐づくリソース）
  const targetResourceId =
    dropInfo.resourceId ??
    draggedEvent.getResources()[0]?.id ??
    draggedEvent.extendedProps.resourceId;

  if (!targetResourceId) {
    return {
      allowed: false,
      message: 'リソースが特定できない場所には予定を移動できません。',
    };
  }

  // 2) 同一リソース・同一時間帯の重複をチェック
  const hasOverlap = hasOverlapOnResource(
    allEvents,
    targetResourceId,
    start,
    end,
    draggedEvent.id
  );

  if (hasOverlap) {
    return {
      allowed: false,
      message: '同じスタッフの同じ時間帯に重複する予定は登録できません。',
    };
  }

  return { allowed: true };
}

/**
 * Issue 8: 新規選択範囲の許可判定（純粋関数版）
 *
 * @param selectInfo - 選択された時間・リソース情報
 * @param allEvents - カレンダー上の全イベント
 * @returns 許可するかどうかとエラーメッセージ
 */
export function checkSelectAllowed(
  selectInfo: EventDropInfo,
  allEvents: TestableEvent[],
): { allowed: boolean; message?: string } {
  const { start, end, resourceId: targetResourceId } = selectInfo;

  // 0) 異常な時間範囲をガード
  if (start >= end) {
    return {
      allowed: false,
      message: '開始時刻は終了時刻より前である必要があります。',
    };
  }

  if (!targetResourceId) {
    return {
      allowed: false,
      message: 'リソース行上でのみ予定を作成できます。',
    };
  }

  const hasOverlap = hasOverlapOnResource(
    allEvents,
    targetResourceId,
    start,
    end
  );

  if (hasOverlap) {
    return {
      allowed: false,
      message: 'すでに予定が入っている時間帯には新しい予定を作成できません。',
    };
  }

  return { allowed: true };
}

/**
 * Issue 10: リソース別総時間計算（純粋関数版）
 *
 * @param events - 計算対象イベント一覧
 * @param workHourLimit - 労働時間上限（デフォルト: 8時間）
 * @returns リソース別の総時間と警告フラグ
 */
export function calculateTotalsByResource(
  events: TestableEvent[],
  workHourLimit = 8,
): Record<string, ResourceWarning> {
  // 背景イベントなどを除外
  const planEvents = events.filter(
    (e) => e.display !== 'background' && e.start && e.end,
  );

  const totals: Record<string, ResourceWarning> = {};

  for (const event of planEvents) {
    const resourceId =
      event.getResources()?.[0]?.id ?? event.extendedProps?.resourceId;
    if (!resourceId) continue;
    if (!event.start || !event.end) continue;

    const durationMs = event.end.getTime() - event.start.getTime();
    const durationHours = Math.max(0, durationMs / (1000 * 60 * 60)); // 負の長さを0クランプ

    if (!totals[resourceId]) {
      totals[resourceId] = { totalHours: 0, isOver: false };
    }
    totals[resourceId].totalHours += durationHours;
  }

  // 小数点1位丸め + 上限判定
  for (const resourceId of Object.keys(totals)) {
    const rounded = Math.round(totals[resourceId].totalHours * 10) / 10;
    totals[resourceId].totalHours = rounded;
    totals[resourceId].isOver = rounded > workHourLimit;
  }

  return totals;
}

/**
 * 警告イベント（FullCalendar EventInput互換）
 */
export interface WarningEventInput {
  id: string;
  resourceId: string;
  title: string;
  start: string;
  end: string;
  display: 'background';
  backgroundColor: string;
  classNames: string[];
  extendedProps: {
    planId: string;
    planType: string;
    planDescription: string;
    status: string;
  };
}

/**
 * Issue 9: 背景警告イベント生成（純粋関数版）
 *
 * @param resourceWarnings - リソース警告情報
 * @param startDate - 表示開始日
 * @param endDate - 表示終了日
 * @returns 背景警告イベント一覧
 */
export function generateWarningEvents(
  resourceWarnings: Record<string, ResourceWarning>,
  startDate: Date,
  endDate: Date,
): WarningEventInput[] {
  const warningEvents: WarningEventInput[] = [];

  Object.entries(resourceWarnings).forEach(([resourceId, warning]) => {
    if (!warning.isOver) return;

    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);

    warningEvents.push({
      id: `warning-${resourceId}-${startDate.getTime()}`,
      title: `⚠️ 過負荷警告 (${warning.totalHours}h)`,
      start: startDate.toISOString().split('T')[0] + 'T00:00:00',
      end: nextDay.toISOString().split('T')[0] + 'T00:00:00', // 翌日00:00（FullCalendar標準）
      resourceId,
      display: 'background',
      backgroundColor: 'rgba(255, 0, 0, 0.15)',
      classNames: ['fc-event-warning-bg'],
      extendedProps: {
        planId: `warning-${resourceId}`,
        planType: 'admin',
        planDescription: `リソース過負荷警告: ${warning.totalHours}時間`,
        status: 'waiting',
      },
    });
  });

  return warningEvents;
}

/**
 * FullCalendar EventAPI → TestableEvent 変換ヘルパー
 */
export function eventApiToTestable(event: EventApi): TestableEvent {
  return {
    id: event.id,
    start: event.start,
    end: event.end,
    display: event.display,
    extendedProps: event.extendedProps,
    getResources: () => event.getResources(),
  };
}