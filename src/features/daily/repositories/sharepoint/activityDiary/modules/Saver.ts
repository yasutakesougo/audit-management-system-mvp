import type { SpFetchFn } from '@/lib/sp/spLists';
import type { ActivityDiaryUpsert, ActivityDiaryMealAmount } from '@/features/daily/domain/activityDiaryTypes';
import { AD_FIELDS, type ADFieldKey, type ADMapping } from '../constants';
import { spWriteResilient } from '@/lib/spWrite';

const LUNCH_AMOUNT_MAP: Record<ActivityDiaryMealAmount, string> = {
    '完食': '完食',
    '多め': '8割',
    '半分': '半分',
    '少なめ': '少量',
    'なし': 'なし',
};

export class ActivityDiarySaver {
  constructor(private readonly spFetch: SpFetchFn) {}

  private mf(mapping: ADMapping, key: ADFieldKey): string {
    return mapping[key] ?? AD_FIELDS[key];
  }

  public async save(
    input: ActivityDiaryUpsert,
    listPath: string,
    listTitle: string,
    mapping: ADMapping,
    existingId?: number,
  ): Promise<unknown> {
    const payload = this.toSpItem(input, mapping);

    const result = await spWriteResilient<unknown>({
      list: listTitle,
      method: existingId ? 'MERGE' : 'POST',
      body: payload,
      additionalHeaders: {
        Prefer: 'return=representation,odata.include-annotations="*"',
      },
      urlBuilder: (_list: string, id?: number) => {
        const base = `${listPath}/items`;
        const finalId = id ?? existingId;
        return finalId ? `${base}(${finalId})` : base;
      },
      fetcher: this.spFetch,
      parse: async (response: Response) => {
        try {
          return await response.json();
        } catch {
          return null;
        }
      },
    });

    if (!result.ok) {
      throw result.error ?? new Error('Failed to save activity diary item');
    }
    return result.data;
  }

  private toSpItem(input: ActivityDiaryUpsert, mapping: ADMapping): Record<string, unknown> {
    const item: Record<string, unknown> = {
      Title: this.buildTitle(input),
      [this.mf(mapping, 'userId')]: input.userId,
      [this.mf(mapping, 'date')]: input.dateISO,
      [this.mf(mapping, 'shift')]: input.period,
      [this.mf(mapping, 'category')]: input.category,
      [this.mf(mapping, 'lunchAmount')]: input.mealMain ? LUNCH_AMOUNT_MAP[input.mealMain] : null,
      [this.mf(mapping, 'mealMain')]: input.mealMain ?? null,
      [this.mf(mapping, 'mealSide')]: input.mealSide ?? null,
      [this.mf(mapping, 'problemBehavior')]: input.behavior?.has ?? false,
      [this.mf(mapping, 'behaviorType')]: this.pickBehaviorType(input.behavior),
      [this.mf(mapping, 'behaviorNote')]: this.buildBehaviorNote(input.behavior),
      [this.mf(mapping, 'seizure')]: input.seizure?.has ?? false,
      [this.mf(mapping, 'seizureAt')]: input.seizure?.has ? input.seizure?.at ?? null : null,
      [this.mf(mapping, 'goals')]: this.buildGoalsValue(input.goalIds),
      [this.mf(mapping, 'notes')]: input.notes ?? '',
    };
    return item;
  }

  private buildTitle(input: ActivityDiaryUpsert): string {
    const fragments = [input.dateISO, input.category, input.period].filter(Boolean);
    const title = fragments.join(' ').trim() || 'ActivityDiary';
    return title.length > 255 ? title.slice(0, 255) : title;
  }

  private pickBehaviorType(behavior?: ActivityDiaryUpsert['behavior']): string | null {
    if (!behavior?.has) return null;
    const BEHAVIOR_TYPE_CHOICES = new Set(['暴言', '離席', 'その他']);
    const firstMatch = (behavior.kinds ?? []).find((kind: string) => BEHAVIOR_TYPE_CHOICES.has(kind));
    return firstMatch || 'その他';
  }

  private buildBehaviorNote(behavior?: ActivityDiaryUpsert['behavior']): string | null {
    if (!behavior?.has) return null;
    const kinds = (behavior.kinds ?? []).map((v: string) => v.trim()).filter(Boolean);
    return kinds.length ? kinds.join(', ') : null;
  }

  private buildGoalsValue(goalIds: ActivityDiaryUpsert['goalIds']): string | null {
    if (!goalIds?.length) return null;
    return goalIds.map(String).join(',');
  }
}
