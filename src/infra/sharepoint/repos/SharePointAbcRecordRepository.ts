/**
 * SharePointAbcRecordRepository — SharePoint リスト (AbcBehaviorRecords) ベースの ABC 記録永続化
 *
 * 制度監査・本番硬化対応。
 * - データの物理削除を禁止し、IsDeleted（Boolean）によるソフトデリートを適用。
 * - 作成者（createdBy / recorderName）および作成日時（createdAt）は不変。
 * - ドメインモデル ↔ SharePoint の物理列名を厳密にマッピング。
 * - 古いデータ、null データを許容するための TypeScript レベルの安全フィルタ。
 */

import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { buildEq, buildNe, joinAnd } from '@/sharepoint/query/builders';
import { LIST_CONFIG, ListKeys } from '@/sharepoint/fields/listRegistry';
import { buildAbcRecordSelectFields } from '@/sharepoint/fields/abcRecordFields';
import type {
  AbcRecord,
  AbcRecordCreateInput,
  AbcIntensity,
  AbcRecordRepository,
} from '@/domain/abc/abcRecord';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// SharePoint 物理行データモデル
interface SpAbcRecordRow {
  Id?: number;
  Title?: string;
  AbcRecordId?: string;
  UserId?: string;
  RecordDate?: string;
  OccurredAt?: string;
  Setting?: string;
  Antecedent?: string;
  Behavior?: string;
  Consequence?: string;
  Intensity?: string;
  DurationMinutes?: number;
  RiskFlag?: boolean;
  TagsJson?: string;
  Notes?: string;
  SourcePage?: string;
  SourceDate?: string;
  SourceSlotId?: string;
  SourceSlotLabel?: string;
  ReturnUrl?: string;
  RecorderName?: string;
  CreatedByCode?: string;
  UpdatedByCode?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  IsDeleted?: boolean;
  DeletedAt?: string;
  DeletedByCode?: string;
  // システム日時フォールバック用
  Created?: string;
  Modified?: string;
}

export class SharePointAbcRecordRepository implements AbcRecordRepository {
  private listName = LIST_CONFIG[ListKeys.AbcBehaviorRecords].title;

  constructor(private client: IDataProvider) {}

  /**
   * SharePoint 物理レコードからドメインエンティティへの復元
   */
  private mapSpToDomain(sp: SpAbcRecordRow): AbcRecord {
    const id = String(sp.Id);
    const tags: string[] = [];

    if (sp.TagsJson) {
      try {
        const parsed = JSON.parse(sp.TagsJson);
        if (Array.isArray(parsed)) {
          tags.push(...parsed.map(String));
        }
      } catch {
        // パース失敗時は空配列のまま
      }
    }

    let sourceContext: AbcRecord['sourceContext'];
    if (sp.SourcePage) {
      sourceContext = {
        source: sp.SourcePage as 'daily-support' | 'standalone',
        date: sp.SourceDate,
        slotId: sp.SourceSlotId,
        slotLabel: sp.SourceSlotLabel,
        returnUrl: sp.ReturnUrl,
      };
    }

    return {
      id,
      userId: sp.UserId || '',
      userName: sp.UserId || '', // 画面表示用フォールバック。必要に応じてマスタから引く
      occurredAt: sp.OccurredAt || '',
      setting: sp.Setting || '',
      antecedent: sp.Antecedent || '',
      behavior: sp.Behavior || '',
      consequence: sp.Consequence || '',
      intensity: (sp.Intensity as AbcIntensity) || 'low',
      durationMinutes: sp.DurationMinutes !== undefined && sp.DurationMinutes !== null ? sp.DurationMinutes : null,
      riskFlag: !!sp.RiskFlag,
      recorderName: sp.RecorderName || '',
      tags,
      notes: sp.Notes || '',
      createdAt: sp.CreatedAt || sp.Created || '',

      // 監査履歴
      abcRecordId: sp.AbcRecordId,
      createdBy: sp.CreatedByCode,
      updatedAt: sp.UpdatedAt || sp.Modified || undefined,
      updatedBy: sp.UpdatedByCode,
      isDeleted: !!sp.IsDeleted,
      deletedAt: sp.DeletedAt,
      deletedBy: sp.DeletedByCode,
      sourceContext,
    };
  }

  /**
   * 保存（新規または更新。ただしインターフェース上、新規は save, 更新は update を明示する運用に沿う）
   */
  async save(input: AbcRecordCreateInput): Promise<AbcRecord> {
    const abcRecordId = input.abcRecordId || generateUUID();
    const createdAt = new Date().toISOString();
    const createdBy = input.createdBy || 'system';

    const payload: SpAbcRecordRow = {
      Title: `${input.userId}_${input.occurredAt}`,
      AbcRecordId: abcRecordId,
      UserId: input.userId,
      RecordDate: input.occurredAt.slice(0, 10), // yyyy-MM-dd
      OccurredAt: input.occurredAt,
      Setting: input.setting,
      Antecedent: input.antecedent,
      Behavior: input.behavior,
      Consequence: input.consequence,
      Intensity: input.intensity,
      DurationMinutes: input.durationMinutes ?? undefined,
      RiskFlag: input.riskFlag,
      TagsJson: JSON.stringify(input.tags),
      Notes: input.notes,
      SourcePage: input.sourceContext?.source,
      SourceDate: input.sourceContext?.date,
      SourceSlotId: input.sourceContext?.slotId,
      SourceSlotLabel: input.sourceContext?.slotLabel,
      ReturnUrl: input.sourceContext?.returnUrl,
      RecorderName: input.recorderName,
      CreatedByCode: createdBy,
      CreatedAt: createdAt,
      IsDeleted: false,
    };

    // SharePoint への新規作成 POST
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await this.client.createItem<any>(this.listName, payload as any);
    const createdId = Number(created?.Id ?? created?.d?.Id ?? created?.data?.Id);

    if (!createdId || !Number.isFinite(createdId)) {
      console.error('[SharePointAbcRecordRepository] Failed to extract ID from create response', created);
      throw new Error('Failed to extract item ID from create response');
    }

    // 最新の全フィールドを確実に取得するため、主キーで再取得 (OData $select/SSOT 準拠)
    const select = [...buildAbcRecordSelectFields()];
    const items = await this.client.listItems<SpAbcRecordRow>(this.listName, {
      select,
      filter: buildEq('Id', createdId),
      top: 1,
    });

    const fullItem = items[0];
    if (!fullItem) {
      throw new Error(`Failed to fetch created ABC record with ID: ${createdId}`);
    }

    return this.mapSpToDomain(fullItem);
  }

  /**
   * 既存レコードの更新
   */
  async update(id: string, fields: Partial<AbcRecordCreateInput>): Promise<AbcRecord | null> {
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw new Error(`Invalid non-numeric ID for SharePoint: ${id}`);
    }

    // 1. 不変フィールド (abcRecordId, createdAt, createdBy, recorderName) を上書き不可にするガード
    const safeFields = { ...fields };
    delete (safeFields as Record<string, unknown>).abcRecordId;
    delete (safeFields as Record<string, unknown>).createdAt;
    delete (safeFields as Record<string, unknown>).createdBy;
    delete (safeFields as Record<string, unknown>).recorderName;

    // 2. 更新ペイロードの構築
    const payload: Partial<SpAbcRecordRow> = {};
    if (safeFields.userId !== undefined) payload.UserId = safeFields.userId;
    if (safeFields.occurredAt !== undefined) {
      payload.OccurredAt = safeFields.occurredAt;
      payload.RecordDate = safeFields.occurredAt.slice(0, 10);
    }
    if (safeFields.setting !== undefined) payload.Setting = safeFields.setting;
    if (safeFields.antecedent !== undefined) payload.Antecedent = safeFields.antecedent;
    if (safeFields.behavior !== undefined) payload.Behavior = safeFields.behavior;
    if (safeFields.consequence !== undefined) payload.Consequence = safeFields.consequence;
    if (safeFields.intensity !== undefined) payload.Intensity = safeFields.intensity;
    if (safeFields.durationMinutes !== undefined) payload.DurationMinutes = safeFields.durationMinutes ?? undefined;
    if (safeFields.riskFlag !== undefined) payload.RiskFlag = safeFields.riskFlag;
    if (safeFields.tags !== undefined) payload.TagsJson = JSON.stringify(safeFields.tags);
    if (safeFields.notes !== undefined) payload.Notes = safeFields.notes;

    if (safeFields.sourceContext !== undefined) {
      payload.SourcePage = safeFields.sourceContext?.source;
      payload.SourceDate = safeFields.sourceContext?.date;
      payload.SourceSlotId = safeFields.sourceContext?.slotId;
      payload.SourceSlotLabel = safeFields.sourceContext?.slotLabel;
      payload.ReturnUrl = safeFields.sourceContext?.returnUrl;
    }

    // 監査情報
    payload.UpdatedAt = new Date().toISOString();
    payload.UpdatedByCode = fields.updatedBy || 'system';

    // SharePoint PATCH 送信
    await this.client.updateItem(this.listName, numericId, payload);

    // 最新の全フィールドで再取得してドメインモデルへ復元
    const select = [...buildAbcRecordSelectFields()];
    const items = await this.client.listItems<SpAbcRecordRow>(this.listName, {
      select,
      filter: buildEq('Id', numericId),
      top: 1,
    });

    const fullItem = items[0];
    if (!fullItem) return null;

    return this.mapSpToDomain(fullItem);
  }

  /**
   * 全件取得（新しい順、かつ論理削除されたものは除外）
   */
  async getAll(): Promise<AbcRecord[]> {
    const select = [...buildAbcRecordSelectFields()];
    // OData ODataFilter: IsDeleted ne true
    const filter = buildNe('IsDeleted', true);

    const rows = await this.client.listItems<SpAbcRecordRow>(this.listName, {
      select,
      filter,
      orderby: 'RecordDate desc, OccurredAt desc',
      top: 500, // 安全上の上限
    });

    // TypeScript 側でも record.isDeleted !== true の追加チェックを適用する防衛層
    return rows
      .map((row) => this.mapSpToDomain(row))
      .filter((record) => record.isDeleted !== true);
  }

  /**
   * 利用者 ID で絞り込み（論理削除されたものは除外）
   */
  async getByUserId(userId: string): Promise<AbcRecord[]> {
    const select = [...buildAbcRecordSelectFields()];
    const filter = joinAnd([
      buildEq('UserId', userId),
      buildNe('IsDeleted', true),
    ]);

    const rows = await this.client.listItems<SpAbcRecordRow>(this.listName, {
      select,
      filter,
      orderby: 'RecordDate desc, OccurredAt desc',
    });

    return rows
      .map((row) => this.mapSpToDomain(row))
      .filter((record) => record.isDeleted !== true);
  }

  /**
   * ID で1件取得（論理削除されている場合は null を返す）
   */
  async getById(id: string): Promise<AbcRecord | null> {
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return null;
    }

    const select = [...buildAbcRecordSelectFields()];
    const filter = joinAnd([
      buildEq('Id', numericId),
      buildNe('IsDeleted', true),
    ]);

    const items = await this.client.listItems<SpAbcRecordRow>(this.listName, {
      select,
      filter,
      top: 1,
    });

    const fullItem = items[0];
    if (!fullItem) return null;

    const record = this.mapSpToDomain(fullItem);
    if (record.isDeleted === true) return null;

    return record;
  }

  /**
   * 論理削除 (Soft Delete) の実行
   */
  async delete(id: string): Promise<void> {
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      throw new Error(`Invalid non-numeric ID for SharePoint: ${id}`);
    }

    const payload: Partial<SpAbcRecordRow> = {
      IsDeleted: true,
      DeletedAt: new Date().toISOString(),
      DeletedByCode: 'system', // 通常はコンテキストから渡すべきだが、今回はシステムフォールバック
    };

    // SharePoint に対する PATCH 更新 (DELETE 物理列削除は禁止)
    await this.client.updateItem(this.listName, numericId, payload);
  }
}
