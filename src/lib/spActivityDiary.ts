import type { SpFieldDef, UseSP } from './spClient';
import { spWriteResilient } from './spWrite';

export type ActivityDiaryMealAmount = '完食' | '多め' | '半分' | '少なめ' | 'なし';
export type ActivityDiaryPeriod = 'AM' | 'PM';
export type ActivityDiaryCategory = '請負' | '個別' | '外活動' | '余暇';

export type ActivityDiaryUpsert = {
  userId: number;
  dateISO: string;
  period: ActivityDiaryPeriod;
  category: ActivityDiaryCategory;
  goalIds: number[];
  mealMain?: ActivityDiaryMealAmount;
  mealSide?: ActivityDiaryMealAmount;
  behavior?: {
    has: boolean;
    kinds?: string[];
  };
  seizure?: {
    has: boolean;
    at?: string;
  };
  notes?: string;
};

type SpActivityDiaryItem = Record<string, unknown>;

type PostResult = {
  d?: {
    Id?: number;
    [key: string]: unknown;
  };
} | null;

type ImportMetaEnv = { env?: Record<string, string | undefined> };

const envRecord = ((import.meta as unknown) as ImportMetaEnv)?.env ?? {};

const DEFAULT_LIST_TITLE = 'ActivityDiary';
const LIST_TITLE = (envRecord.VITE_SP_LIST_ACTIVITY_DIARY ?? '').trim() || DEFAULT_LIST_TITLE;
const LIST_PATH = `/lists/getbytitle('${encodeURIComponent(LIST_TITLE)}')/items` as const;

const sanitizeEnvValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const USERS_LIST_TITLE = sanitizeEnvValue(envRecord.VITE_SP_LIST_USERS) || 'Users_Master';

const normalizeGuid = (value: string | null | undefined): string => (value ?? '').replace(/[{}]/g, '').trim();

let cachedUserListId: string | null = null;
let ensureActivityDiaryPromise: Promise<void> | null = null;

const MEAL_CHOICES = ['完食', '多め', '半分', '少なめ', 'なし'] as const;

const LUNCH_AMOUNT_MAP: Record<ActivityDiaryMealAmount, '完食' | '8割' | '半分' | '少量' | 'なし'> = {
  '完食': '完食',
  '多め': '8割',
  '半分': '半分',
  '少なめ': '少量',
  'なし': 'なし',
};

const BEHAVIOR_TYPE_CHOICES = new Set(['暴言', '離席', 'その他']);
const CATEGORY_CHOICES: readonly ActivityDiaryCategory[] = ['請負', '個別', '外活動', '余暇'];
const SHIFT_CHOICES = ['AM', 'PM', '1日'] as const;
const LUNCH_CHOICES = ['完食', '8割', '半分', '少量', 'なし'] as const;
const BEHAVIOR_CHOICES = ['暴言', '離席', 'その他'] as const;

async function fetchListIdByTitle(sp: Pick<UseSP, 'spFetch'>, listTitle: string): Promise<string> {
  const encoded = encodeURIComponent(listTitle);
  const res = await sp.spFetch(`/lists/getbytitle('${encoded}')?$select=Id`);
  const data = (await res.json().catch(() => ({}))) as { Id?: string } | Record<string, unknown>;
  const record = data as Record<string, unknown>;
  const idCandidate = typeof data?.Id === 'string' ? data.Id : typeof record?.id === 'string' ? (record.id as string) : '';
  const normalized = normalizeGuid(idCandidate);
  if (!normalized) {
    throw new Error(`SharePoint リスト "${listTitle}" の ID を取得できませんでした。`);
  }
  return normalized;
}

async function resolveUserListId(sp: Pick<UseSP, 'spFetch'>): Promise<string> {
  if (cachedUserListId) {
    return cachedUserListId;
  }
  try {
    const id = await fetchListIdByTitle(sp, USERS_LIST_TITLE);
    cachedUserListId = id;
    return id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`利用者マスタの確認に失敗しました: ${message}`);
  }
}

async function ensureActivityDiaryList(sp: Pick<UseSP, 'spFetch' | 'ensureListExists'>): Promise<void> {
  if (!ensureActivityDiaryPromise) {
    ensureActivityDiaryPromise = (async () => {
      const userListId = await resolveUserListId(sp);
      const fields: SpFieldDef[] = [
        { internalName: 'Title', type: 'Text', required: true },
        { internalName: 'UserId', type: 'Lookup', required: true, lookupListId: userListId },
        { internalName: 'Date', type: 'DateTime', required: true },
        { internalName: 'Category', type: 'Choice', required: true, choices: [...CATEGORY_CHOICES] },
        { internalName: 'Shift', type: 'Choice', required: true, choices: [...SHIFT_CHOICES] },
        { internalName: 'LunchAmount', type: 'Choice', choices: [...LUNCH_CHOICES] },
  { internalName: 'MealMain', type: 'Choice', choices: [...MEAL_CHOICES] },
  { internalName: 'MealSide', type: 'Choice', choices: [...MEAL_CHOICES] },
  { internalName: 'ProblemBehavior', type: 'Boolean' },
  { internalName: 'Seizure', type: 'Boolean' },
        { internalName: 'BehaviorType', type: 'Choice', choices: [...BEHAVIOR_CHOICES] },
        { internalName: 'BehaviorNote', type: 'Note' },
        { internalName: 'SeizureAt', type: 'DateTime' },
        { internalName: 'Goals', type: 'Note' },
        { internalName: 'Notes', type: 'Note' },
      ];
      try {
        await sp.ensureListExists(LIST_TITLE, fields);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`支援記録（ケース記録）リストの作成に失敗しました: ${message}`);
      }
    })();
  }

  try {
    await ensureActivityDiaryPromise;
  } catch (error) {
    ensureActivityDiaryPromise = null;
    throw error;
  }
}

const toLunchAmount = (meal?: ActivityDiaryMealAmount | null): string | null => {
  if (!meal) return null;
  return LUNCH_AMOUNT_MAP[meal] ?? null;
};

const pickBehaviorType = (behavior?: ActivityDiaryUpsert['behavior']): string | null => {
  if (!behavior?.has) return null;
  const firstMatch = (behavior.kinds ?? []).find((kind) => BEHAVIOR_TYPE_CHOICES.has(kind));
  if (firstMatch) {
    return firstMatch;
  }
  return 'その他';
};

const buildBehaviorNote = (behavior?: ActivityDiaryUpsert['behavior']): string | null => {
  if (!behavior?.has) return null;
  const kinds = (behavior.kinds ?? []).map((value) => value.trim()).filter(Boolean);
  return kinds.length ? kinds.join(', ') : null;
};

const buildGoalsValue = (goalIds: ActivityDiaryUpsert['goalIds']): string | null => {
  if (!goalIds?.length) return null;
  return goalIds.map((id) => String(id)).join(',');
};

const buildDiaryTitle = (input: ActivityDiaryUpsert): string => {
  const fragments = [input.dateISO, input.category, input.period].filter(Boolean);
  const title = fragments.join(' ').trim() || 'ActivityDiary';
  return title.length > 255 ? title.slice(0, 255) : title;
};

export const toSpActivityDiaryItem = (input: ActivityDiaryUpsert): SpActivityDiaryItem => {
  return {
    Title: buildDiaryTitle(input),
    UserIdId: input.userId,
    Date: input.dateISO,
    Shift: input.period,
    Category: input.category,
    LunchAmount: toLunchAmount(input.mealMain),
    MealMain: input.mealMain ?? null,
    MealSide: input.mealSide ?? null,
    ProblemBehavior: input.behavior?.has ?? false,
    BehaviorType: pickBehaviorType(input.behavior),
    BehaviorNote: buildBehaviorNote(input.behavior),
    Seizure: input.seizure?.has ?? false,
    SeizureAt: input.seizure?.has ? input.seizure?.at ?? null : null,
    Goals: buildGoalsValue(input.goalIds),
    Notes: input.notes ?? '',
  } satisfies SpActivityDiaryItem;
};

export async function postActivityDiary(sp: Pick<UseSP, 'spFetch' | 'ensureListExists'>, payload: ActivityDiaryUpsert) {
  await ensureActivityDiaryList(sp);
  const result = await spWriteResilient<PostResult | null>({
    list: LIST_TITLE,
    method: 'POST',
    body: toSpActivityDiaryItem(payload),
    additionalHeaders: {
      Prefer: 'return=representation,odata.include-annotations="*"',
    },
  urlBuilder: (_list: string, id?: number) => (typeof id === 'number' ? `${LIST_PATH}(${id})` : LIST_PATH),
  fetcher: sp.spFetch,
  parse: async (response: Response) => {
      try {
        return (await response.json()) as PostResult;
      } catch {
        return null;
      }
    },
  });
  if (!result.ok) {
    throw result.error ?? new Error('Failed to post activity diary item');
  }
  const json = result.data ?? null;
  return json?.d ?? json;
}

export const __activityDiaryInternals = {
  resetCache() {
    cachedUserListId = null;
    ensureActivityDiaryPromise = null;
  },
};
