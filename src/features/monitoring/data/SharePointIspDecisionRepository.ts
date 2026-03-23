/**
 * @fileoverview SharePoint 実装 — ISP 判断記録の永続化
 * @description
 * SharePoint リスト「IspRecommendationDecisions」を使い、
 * ISP 見直し提案に対する判断レコードを CRUD する。
 *
 * リスト列マッピング:
 * | SP 列名           | ドメイン型フィールド                | SP 型         |
 * |--------------------|------------------------------------|---------------|
 * | Title              | id (自動採番 UUID)                  | Single text   |
 * | GoalId             | goalId                             | Single text   |
 * | UserId             | userId                             | Single text   |
 * | Status             | status                             | Single text   |
 * | DecidedBy          | decidedBy                          | Single text   |
 * | DecidedAt          | decidedAt (ISO 8601)               | DateTime      |
 * | Note               | note                               | Multi text    |
 * | MonitoringFrom     | monitoringPeriod.from              | Single text   |
 * | MonitoringTo       | monitoringPeriod.to                | Single text   |
 * | SnapshotJson       | snapshot (JSON.stringify)           | Multi text    |
 */
import { get as getEnv } from '@/env';
import { toSafeError } from '@/lib/errors';
import { ensureListExists } from '@/lib/sp/spListSchema';
import type { SpFetchFn } from '@/lib/sp/spLists';
import type { SpFieldDef } from '@/lib/sp/types';

import type { IspRecommendationDecision } from '../domain/ispRecommendationDecisionTypes';
import type {
  DecisionListFilter,
  IspDecisionRepository,
  SaveDecisionInput,
} from './IspDecisionRepository';

import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

// ─── 定数 ────────────────────────────────────────────────

const DEFAULT_LIST_TITLE = 'IspRecommendationDecisions';

const getListTitle = (): string =>
  getEnv('VITE_SP_LIST_ISP_DECISIONS', DEFAULT_LIST_TITLE);

const SP_FIELDS = {
  title: 'Title',
  goalId: 'GoalId',
  userId: 'UserId',
  status: 'Status',
  decidedBy: 'DecidedBy',
  decidedAt: 'DecidedAt',
  note: 'Note',
  monitoringFrom: 'MonitoringFrom',
  monitoringTo: 'MonitoringTo',
  snapshotJson: 'SnapshotJson',
  created: 'Created',
  modified: 'Modified',
} as const;

const ALL_SELECT_FIELDS = [
  'Id',
  SP_FIELDS.title,
  SP_FIELDS.goalId,
  SP_FIELDS.userId,
  SP_FIELDS.status,
  SP_FIELDS.decidedBy,
  SP_FIELDS.decidedAt,
  SP_FIELDS.note,
  SP_FIELDS.monitoringFrom,
  SP_FIELDS.monitoringTo,
  SP_FIELDS.snapshotJson,
  SP_FIELDS.created,
  SP_FIELDS.modified,
].join(',');

/** リスト自動作成用の列定義 */
const ISP_DECISION_FIELD_DEFS: SpFieldDef[] = [
  // Title は既定列なので定義不要
  { internalName: 'GoalId', type: 'Text', required: true },
  { internalName: 'UserId', type: 'Text', required: true },
  { internalName: 'Status', type: 'Text', required: true },
  { internalName: 'DecidedBy', type: 'Text', required: true },
  { internalName: 'DecidedAt', type: 'DateTime', required: true },
  { internalName: 'Note', type: 'Note', required: false },
  { internalName: 'MonitoringFrom', type: 'Text', required: true },
  { internalName: 'MonitoringTo', type: 'Text', required: true },
  { internalName: 'SnapshotJson', type: 'Note', required: true },
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
const toDecision = (item: Record<string, unknown>): IspRecommendationDecision | null => {
  try {
    const snapshotRaw = item[SP_FIELDS.snapshotJson];
    const snapshot = typeof snapshotRaw === 'string' ? JSON.parse(snapshotRaw) : null;
    if (!snapshot) return null;

    return {
      id: String(item[SP_FIELDS.title] ?? ''),
      goalId: String(item[SP_FIELDS.goalId] ?? ''),
      userId: String(item[SP_FIELDS.userId] ?? ''),
      status: String(item[SP_FIELDS.status] ?? 'pending') as IspRecommendationDecision['status'],
      decidedBy: String(item[SP_FIELDS.decidedBy] ?? ''),
      decidedAt: String(item[SP_FIELDS.decidedAt] ?? ''),
      note: String(item[SP_FIELDS.note] ?? ''),
      monitoringPeriodFrom: String(item[SP_FIELDS.monitoringFrom] ?? ''),
      monitoringPeriodTo: String(item[SP_FIELDS.monitoringTo] ?? ''),
      snapshot,
    };
  } catch (e) {
    console.warn('[SharePointIspDecisionRepository] Failed to parse item', e);
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
const ensureIspDecisionList = (spFetch: SpFetchFn): Promise<void> => {
  if (!ensureListPromise) {
    ensureListPromise = (async () => {
      try {
        const listTitle = getListTitle();
        await ensureListExists(spFetch, listTitle, ISP_DECISION_FIELD_DEFS);
        console.info(`[SharePointIspDecisionRepository] List "${listTitle}" ensured`);
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

export class SharePointIspDecisionRepository implements IspDecisionRepository {
  constructor(private readonly spFetch: SpFetchFn) {}

  async save(input: SaveDecisionInput): Promise<IspRecommendationDecision> {
    await ensureIspDecisionList(this.spFetch);
    const id = generateId();
    try {
      const listPath = buildListPath();

      const itemData = {
        [SP_FIELDS.title]: id,
        [SP_FIELDS.goalId]: input.goalId,
        [SP_FIELDS.userId]: input.userId,
        [SP_FIELDS.status]: input.status,
        [SP_FIELDS.decidedBy]: input.decidedBy,
        [SP_FIELDS.decidedAt]: input.decidedAt,
        [SP_FIELDS.note]: input.note,
        [SP_FIELDS.monitoringFrom]: input.monitoringPeriodFrom,
        [SP_FIELDS.monitoringTo]: input.monitoringPeriodTo,
        [SP_FIELDS.snapshotJson]: JSON.stringify(input.snapshot),
      };

      await this.spFetch(`${listPath}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: JSON.stringify(itemData),
      });

      return { ...input, id };
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointIspDecisionRepository] Save failed', {
        goalId: input.goalId,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  async list(filter: DecisionListFilter & { limit?: number }): Promise<IspRecommendationDecision[]> {
    if (filter.signal?.aborted) return [];
    await ensureIspDecisionList(this.spFetch);

    try {
      const listPath = buildListPath();

      // OData フィルタ構築
      const filters: string[] = [`${SP_FIELDS.userId} eq '${filter.userId}'`];

      if (filter.goalId) {
        filters.push(`${SP_FIELDS.goalId} eq '${filter.goalId}'`);
      }

      if (filter.monitoringPeriod) {
        filters.push(`${SP_FIELDS.monitoringFrom} eq '${filter.monitoringPeriod.from}'`);
        filters.push(`${SP_FIELDS.monitoringTo} eq '${filter.monitoringPeriod.to}'`);
      }

      const params = new URLSearchParams();
      // PERF: SharePoint list index recommended on columns: UserId, GoalId
      // Without indexes, $filter on large lists (>5000 items) will hit throttle threshold.
      // Action: Add column indexes via SharePoint site settings or PnP PowerShell.
      // See: nightly-autonomous-report 2026-03-23 — P1 SharePoint index recommendation
      params.set('$filter', filters.join(' and '));
      params.set('$orderby', `${SP_FIELDS.decidedAt} desc`);

      const limit = filter.limit ?? SP_QUERY_LIMITS.default;
      const safeLimit = Math.min(Math.max(1, limit), SP_QUERY_LIMITS.hardMax);
      params.set('$top', String(safeLimit));
      params.set('$select', ALL_SELECT_FIELDS);

      const response = await this.spFetch(`${listPath}/items?${params.toString()}`);

      const payload = (await response.json()) as SpResponse<Record<string, unknown>>;
      const items = payload.value ?? [];

      const decisions: IspRecommendationDecision[] = [];
      for (const item of items) {
        const d = toDecision(item);
        if (d) decisions.push(d);
      }

      return decisions;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointIspDecisionRepository] List failed', {
        userId: filter.userId,
        error: safeError.message,
      });
      throw safeError;
    }
  }
}

// シングルトンインスタンスはファクトリ (createIspDecisionRepository) で生成する
