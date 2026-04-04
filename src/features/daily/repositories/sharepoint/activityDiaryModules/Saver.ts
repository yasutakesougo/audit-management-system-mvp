/**
 * ActivityDiary Saver — GenericSaver 利用版
 *
 * ドメイン固有のペイロード変換（食事・行動問題マッピング）のみ担当。
 * Fail-Open ペイロード構築と SP REST 操作は GenericSaver に委譲。
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import {
    ActivityDiaryUpsert,
    ActivityDiaryMealAmount,
} from '../../../domain/legacy/ActivityDiaryRepository';
import { auditLog } from '@/lib/debugLogger';
import { ActivityDiarySchemaResolver } from './SchemaResolver';
import {
    buildFailOpenPayload,
    type FieldMapping,
} from '@/lib/sp/GenericSaver';

const LUNCH_AMOUNT_MAP: Record<ActivityDiaryMealAmount, string> = {
    '完食': '完食',
    '多め': '8割',
    '半分': '半分',
    '少なめ': '少量',
    'なし': 'なし',
};

const BEHAVIOR_TYPE_CHOICES = new Set(['暴言', '離席', 'その他']);

export class ActivityDiarySaver {
    constructor(
        private readonly spFetch: SpFetchFn,
        private readonly schema: ActivityDiarySchemaResolver
    ) {}

    public async save(
        input: ActivityDiaryUpsert,
        listPath: string
    ): Promise<void> {
        try {
            const resolved = await this.schema.getResolvedCanonicalNames();

            // ドメイン固有: 行動問題・食事の前処理
            const behaviorHas = input.behavior?.has ?? false;
            const behaviorType = behaviorHas
                ? (input.behavior?.kinds ?? []).find(k => BEHAVIOR_TYPE_CHOICES.has(k)) ?? 'その他'
                : null;
            const behaviorNote = behaviorHas
                ? (input.behavior?.kinds ?? []).join(', ')
                : null;

            const goalsValue = input.goalIds?.length
                ? input.goalIds.map(id => String(id)).join(',')
                : null;

            const title = `${input.dateISO} ${input.category} ${input.period}`.slice(0, 255);

            // ドメイン固有: ActivityDiaryUpsert → FieldMapping[] 変換
            const mappings: FieldMapping[] = [
                [title, 'title'],
                [input.userId, 'userId'],
                [input.dateISO, 'date'],
                [input.period, 'shift'],
                [input.category, 'category'],
                [this.toLunchAmount(input.mealMain), 'lunchAmount'],
                [input.mealMain ?? null, 'mealMain'],
                [input.mealSide ?? null, 'mealSide'],
                [behaviorHas, 'problemBehavior'],
                [behaviorType, 'behaviorType'],
                [behaviorNote, 'behaviorNote'],
                [input.seizure?.has ?? false, 'seizure'],
                [input.seizure?.has ? input.seizure?.at ?? null : null, 'seizureAt'],
                [goalsValue, 'goals'],
                [input.notes ?? '', 'notes'],
            ];

            const { payload } = buildFailOpenPayload(
                resolved,
                mappings,
                'ActivityDiary',
            );

            const res = await this.spFetch(`${listPath}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;odata=nometadata',
                    'Accept': 'application/json;odata=nometadata',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Failed to save ActivityDiary: ${res.status} ${errorText}`);
            }

            auditLog.info('daily', 'ActivityDiary saved successfully', { date: input.dateISO });
        } catch (error) {
            auditLog.error('daily', 'ActivityDiary save failed', { error: String(error) });
            throw error;
        }
    }

    private toLunchAmount(meal?: ActivityDiaryMealAmount | null): string | null {
        if (!meal) return null;
        return LUNCH_AMOUNT_MAP[meal] ?? null;
    }
}
