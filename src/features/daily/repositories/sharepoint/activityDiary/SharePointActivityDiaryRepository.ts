import type { SpFetchFn } from '@/lib/sp/spLists';
import type { ActivityDiaryUpsert } from '../../../domain/activityDiaryTypes';
import { AD_FIELDS, getADListTitle } from './constants';
import { ActivityDiarySchemaResolver } from './modules/SchemaResolver';
import { ActivityDiaryDataAccess } from './modules/DataAccess';
import { ActivityDiarySaver } from './modules/Saver';

type SharePointActivityDiaryRepositoryOptions = {
    listTitle?: string;
    spFetch?: SpFetchFn;
};

export class SharePointActivityDiaryRepository {
    private readonly spFetch: SpFetchFn;
    private readonly listTitle: string;

    private readonly schema: ActivityDiarySchemaResolver;
    private readonly data: ActivityDiaryDataAccess;
    private readonly saver: ActivityDiarySaver;

    constructor(options: SharePointActivityDiaryRepositoryOptions = {}) {
        if (!options.spFetch) {
            throw new Error('[SharePointActivityDiaryRepository] spFetch is required.');
        }
        this.spFetch = options.spFetch;
        this.listTitle = options.listTitle ?? getADListTitle();

        this.schema = new ActivityDiarySchemaResolver(this.spFetch, this.listTitle);
        this.data = new ActivityDiaryDataAccess(this.spFetch);
        this.saver = new ActivityDiarySaver(this.spFetch);
    }

    /**
     * 生活訓練等の記録を保存する
     */
    async save(input: ActivityDiaryUpsert, signal?: AbortSignal): Promise<unknown> {
        const resolved = await this.schema.resolve();
        if (!resolved) {
            throw new Error(`Activity diary list not found or schema mismatch: ${this.listTitle}`);
        }

        const { listPath, mapping } = resolved;
        const shiftField = mapping.shift ?? AD_FIELDS.shift;
        const categoryField = mapping.category ?? AD_FIELDS.category;
        
        // 同一の日の記録があるか確認し、あれば更新、なければ作成
        const existing = await this.data.loadByDate(input.dateISO, input.userId, listPath, mapping, signal);
        const existingItem = (existing ?? []).find(item => 
          item[shiftField] === input.period &&
          item[categoryField] === input.category
        );
        const rawId = existingItem?.Id;
        const existingId =
          typeof rawId === 'number'
            ? rawId
            : (typeof rawId === 'string' && Number.isFinite(Number(rawId)))
              ? Number(rawId)
              : undefined;

        return this.saver.save(input, listPath, this.listTitle, mapping, existingId);
    }

    /**
     * 過去の記録をロードする
     */
    async load(date: string, userId: number | string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
        const resolved = await this.schema.resolve();
        if (!resolved) return [];
        return this.data.loadByDate(date, userId, resolved.listPath, resolved.mapping, signal);
    }
}
