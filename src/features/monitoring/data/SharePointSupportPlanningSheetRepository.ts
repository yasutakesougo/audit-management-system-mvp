/**
 * @fileoverview SharePoint 実装 — SupportPlanningSheet_Master の永続化
 * @description
 * SharePoint リスト「SupportPlanningSheet_Master」を使い、
 * ISP 計画書判断レコードを CRUD する。
 *
 * リスト自動プロビジョニング:
 *   初回アクセス時に ensureListExists で存在チェック → 自動作成 → 不足列追加。
 *   Promise キャッシュにより 2回目以降は即座に resolve。
 *
 * リスト列マッピング:
 * | SP 列名               | ドメイン型フィールド           | SP 型         |
 * |------------------------|-----------------------------|---------------|
 * | Title                  | id (自動採番 UUID)           | Single text   |
 * | UserId                 | userId                      | Single text   |
 * | GoalId                 | goalId                      | Single text   |
 * | GoalLabel              | goalLabel                   | Single text   |
 * | DecisionStatus         | decisionStatus              | Single text   |
 * | DecisionNote           | decisionNote                | Multi text    |
 * | DecisionBy             | decisionBy                  | Single text   |
 * | DecisionAt             | decisionAt (ISO 8601)       | DateTime      |
 * | RecommendationLevel    | recommendationLevel         | Single text   |
 * | SnapshotJson           | snapshot (JSON.stringify)    | Multi text    |
 */
import { get as getEnv } from '@/env';
import { toSafeError } from '@/lib/errors';
import { ensureListExists } from '@/lib/sp/spListSchema';
import type { SpFetchFn } from '@/lib/sp/spLists';
import type { SpFieldDef } from '@/lib/sp/types';

import type { SupportPlanningSheetRecord } from '../domain/supportPlanningSheetTypes';
import type {
  SaveSupportPlanningSheetInput,
  SupportPlanningSheetFilter,
} from '../domain/supportPlanningSheetTypes';
import type { SupportPlanningSheetRepository } from './SupportPlanningSheetRepository';

import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

// ─── 定数 ────────────────────────────────────────────────

const DEFAULT_LIST_TITLE = 'SupportPlanningSheet_Master';

const getListTitle = (): string =>
  getEnv('VITE_SP_LIST_SUPPORT_PLANNING_SHEET', DEFAULT_LIST_TITLE);

const SP_FIELDS = {
  title: 'Title',
  userId: 'UserId',
  goalId: 'GoalId',
  goalLabel: 'GoalLabel',
  decisionStatus: 'DecisionStatus',
  decisionNote: 'DecisionNote',
  decisionBy: 'DecisionBy',
  decisionAt: 'DecisionAt',
  recommendationLevel: 'RecommendationLevel',
  snapshotJson: 'SnapshotJson',
  created: 'Created',
  modified: 'Modified',
} as const;

const ALL_SELECT_FIELDS = [
  'Id',
  SP_FIELDS.title,
  SP_FIELDS.userId,
  SP_FIELDS.goalId,
  SP_FIELDS.goalLabel,
  SP_FIELDS.decisionStatus,
  SP_FIELDS.decisionNote,
  SP_FIELDS.decisionBy,
  SP_FIELDS.decisionAt,
  SP_FIELDS.recommendationLevel,
  SP_FIELDS.snapshotJson,
  SP_FIELDS.created,
  SP_FIELDS.modified,
].join(',');

/** リスト自動作成用の列定義 */
const SUPPORT_PLANNING_SHEET_FIELD_DEFS: SpFieldDef[] = [
  // Title は既定列なので定義不要
  { internalName: 'UserId', type: 'Text', required: true },
  { internalName: 'GoalId', type: 'Text', required: true },
  { internalName: 'GoalLabel', type: 'Text', required: false },
  { internalName: 'DecisionStatus', type: 'Text', required: true },
  { internalName: 'DecisionNote', type: 'Note', required: false },
  { internalName: 'DecisionBy', type: 'Text', required: true },
  { internalName: 'DecisionAt', type: 'DateTime', required: true },
  { internalName: 'RecommendationLevel', type: 'Text', required: false },
  { internalName: 'SnapshotJson', type: 'Note', required: false },
];

/** ensureListExists 初期化用の Promise（一度だけ実行） */
let ensureListPromise: Promise<void> | null = null;

// ─── ヘルパー ────────────────────────────────────────────

type SpResponse<T> = { value?: T[] };

const buildListPath = (): string => {
  const title = getListTitle();
  return `/lists/GetByTitle('${encodeURIComponent(title)}')`;
};

// readSpErrorMessage 削除: spFetch (throwOnError: true) が SpHttpError として自動 throw する

/** SharePoint アイテム → ドメインオブジェクト */
const toRecord = (item: Record<string, unknown>): SupportPlanningSheetRecord | null => {
  try {
    const snapshotRaw = item[SP_FIELDS.snapshotJson];
    const snapshot = typeof snapshotRaw === 'string' ? JSON.parse(snapshotRaw) : null;

    return {
      id: String(item[SP_FIELDS.title] ?? ''),
      userId: String(item[SP_FIELDS.userId] ?? ''),
      goalId: String(item[SP_FIELDS.goalId] ?? ''),
      goalLabel: String(item[SP_FIELDS.goalLabel] ?? ''),
      decisionStatus: String(item[SP_FIELDS.decisionStatus] ?? 'pending') as SupportPlanningSheetRecord['decisionStatus'],
      decisionNote: String(item[SP_FIELDS.decisionNote] ?? ''),
      decisionBy: String(item[SP_FIELDS.decisionBy] ?? ''),
      decisionAt: String(item[SP_FIELDS.decisionAt] ?? ''),
      recommendationLevel: String(item[SP_FIELDS.recommendationLevel] ?? 'none') as SupportPlanningSheetRecord['recommendationLevel'],
      snapshot: snapshot ?? { level: 'none', reason: '', progressLevel: '', rate: 0, trend: '', matchedRecordCount: 0, matchedTagCount: 0 },
    };
  } catch (e) {
    console.warn('[SharePointSupportPlanningSheetRepository] Failed to parse item', e);
    return null;
  }
};

/** UUID 生成 */
const generateId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ─── リスト自動作成 ───────────────────────────────────────

// createRelativeSpFetch 削除: spFetch がそのまま相対パスを受け付ける

/**
 * 初回呼び出し時にリストが存在するか確認し、なければ自動作成する。
 * 2回目以降は即座に resolve する (Promise キャッシュ)。
 */
const ensureSupportPlanningSheetList = (spFetch: SpFetchFn): Promise<void> => {
  if (!ensureListPromise) {
    ensureListPromise = (async () => {
      try {
        const listTitle = getListTitle();
        await ensureListExists(spFetch, listTitle, SUPPORT_PLANNING_SHEET_FIELD_DEFS);
        console.info(`[SharePointSupportPlanningSheetRepository] List "${listTitle}" ensured`);
      } catch (error) {
        // 失敗時は次回リトライ可能にする
        ensureListPromise = null;
        throw error;
      }
    })();
  }
  return ensureListPromise;
};

// ─── Repository 実装 ─────────────────────────────────────

export class SharePointSupportPlanningSheetRepository implements SupportPlanningSheetRepository {
  constructor(private readonly spFetch: SpFetchFn) {}

  async save(input: SaveSupportPlanningSheetInput): Promise<SupportPlanningSheetRecord> {
    await ensureSupportPlanningSheetList(this.spFetch);
    const id = generateId();
    try {
      const listPath = buildListPath();

      const itemData = {
        [SP_FIELDS.title]: id,
        [SP_FIELDS.userId]: input.userId,
        [SP_FIELDS.goalId]: input.goalId,
        [SP_FIELDS.goalLabel]: input.goalLabel,
        [SP_FIELDS.decisionStatus]: input.decisionStatus,
        [SP_FIELDS.decisionNote]: input.decisionNote,
        [SP_FIELDS.decisionBy]: input.decisionBy,
        [SP_FIELDS.decisionAt]: input.decisionAt,
        [SP_FIELDS.recommendationLevel]: input.recommendationLevel,
        [SP_FIELDS.snapshotJson]: JSON.stringify(input.snapshot),
      };

      await this.spFetch(`${listPath}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;odata=verbose',
          Accept: 'application/json;odata=verbose',
        },
        body: JSON.stringify(itemData),
      });

      return { ...input, id };
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointSupportPlanningSheetRepository] Save failed', {
        userId: input.userId,
        goalId: input.goalId,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  async list(filter: SupportPlanningSheetFilter & { limit?: number }): Promise<SupportPlanningSheetRecord[]> {
    if (filter.signal?.aborted) return [];
    await ensureSupportPlanningSheetList(this.spFetch);

    try {
      const listPath = buildListPath();

      // OData フィルタ構築
      const filters: string[] = [`${SP_FIELDS.userId} eq '${filter.userId}'`];

      if (filter.goalId) {
        filters.push(`${SP_FIELDS.goalId} eq '${filter.goalId}'`);
      }

      const params = new URLSearchParams();
      // TODO: SharePoint側でこの列(UserId, GoalId等)にインデックス設定が必要かも
      params.set('$filter', filters.join(' and '));
      params.set('$orderby', `${SP_FIELDS.decisionAt} desc`);

      const limit = filter.limit ?? SP_QUERY_LIMITS.default;
      const safeLimit = Math.min(Math.max(1, limit), SP_QUERY_LIMITS.hardMax);
      params.set('$top', String(safeLimit));
      params.set('$select', ALL_SELECT_FIELDS);

      const response = await this.spFetch(`${listPath}/items?${params.toString()}`);

      const payload = (await response.json()) as SpResponse<Record<string, unknown>>;
      const items = payload.value ?? [];

      const records: SupportPlanningSheetRecord[] = [];
      for (const item of items) {
        const r = toRecord(item);
        if (r) records.push(r);
      }

      return records;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointSupportPlanningSheetRepository] List failed', {
        userId: filter.userId,
        error: safeError.message,
      });
      throw safeError;
    }
  }
}

// シングルトンインスタンスはファクトリ (createSupportPlanningSheetRepository) で生成する
