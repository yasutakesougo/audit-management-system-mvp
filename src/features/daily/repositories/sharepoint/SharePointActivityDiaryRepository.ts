// contract:allow-sp-direct
import { acquireSpAccessToken } from '@/lib/msal';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { 
    ActivityDiaryRepository, 
    ActivityDiaryUpsert, 
    ActivityDiaryRecord 
} from '../../domain/legacy/ActivityDiaryRepository';
import { ActivityDiarySchemaResolver } from './activityDiaryModules/SchemaResolver';
import { ActivityDiarySaver } from './activityDiaryModules/Saver';


export class SharePointActivityDiaryRepository implements ActivityDiaryRepository {
    private readonly spFetch: ReturnType<typeof createSpClient>['spFetch'];
    private readonly schema: ActivityDiarySchemaResolver;
    private readonly saver: ActivityDiarySaver;

    constructor(options: { sp?: ReturnType<typeof createSpClient> } = {}) {
        const { baseUrl } = ensureConfig();
        const sp = options.sp ?? createSpClient(acquireSpAccessToken, baseUrl);
        this.spFetch = sp.spFetch;
        
        // リスト名はレジストリ/環境変数から解決可能だが、
        // デフォルトは 'ActivityDiary'
        const listTitle = 'ActivityDiary'; 
        
        this.schema = new ActivityDiarySchemaResolver(this.spFetch, listTitle);
        this.saver = new ActivityDiarySaver(this.spFetch, this.schema);
    }

    /**
     * 活動日誌（ケース記録）を追加する。
     * スキーマドリフト耐性を備えた動的フィールド解決を使用。
     */
    public async add(upsert: ActivityDiaryUpsert): Promise<ActivityDiaryRecord> {
        const listPath = await this.schema.resolveListPath();
        if (!listPath) {
            throw new Error('[ActivityDiaryRepository] Could not resolve list path for ActivityDiary');
        }

        await this.saver.save(upsert, listPath);

        // TODO: 保存した後の最新レコードを取得して返すロジックが必要な場合は実装
        // 現時点では lib/spActivityDiary.ts の互換性維持のため、最低限の返値を想定
        return {
            id: 'temp-id',
            userId: String(upsert.userId),
            date: upsert.dateISO,
            shift: upsert.period,
            category: inputToDiaryCategory(upsert.category),
            problemBehavior: upsert.behavior?.has ?? false,
            seizure: upsert.seizure?.has ?? false,
        } as ActivityDiaryRecord;
    }
}

// 内部型変換用
function inputToDiaryCategory(cat: string): unknown {
    return cat;
}
