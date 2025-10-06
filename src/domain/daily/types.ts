import { z } from 'zod';

export const DailyStatusZ = z.enum(['未作成', '作成中', '完了']);
export type DailyStatus = z.infer<typeof DailyStatusZ>;

const TrimmedString = z.string().transform((value) => value.trim());
const NonEmptyTrimmed = TrimmedString.pipe(z.string().min(1, '必須項目です'));
const YmdString = z.string().regex(/^(\d{4})-(\d{2})-(\d{2})$/, 'YYYY-MM-DD');
const StringList = z
  .array(TrimmedString)
  .default([])
  .transform((values) => {
    const deduped = new Set(values.filter(Boolean));
    return Array.from(deduped);
  });

export const DraftMetaZ = z
  .object({
    isDraft: z.boolean().default(true),
    savedAt: z.string().datetime().optional(),
  })
  .partial()
  .default({})
  .transform((value) => ({
    isDraft: value.isDraft ?? true,
    ...(value.savedAt ? { savedAt: value.savedAt } : {}),
  }));
export type DraftMeta = z.infer<typeof DraftMetaZ>;

export const ReporterZ = z.object({
  id: z.string().optional(),
  name: NonEmptyTrimmed,
});
export type Reporter = z.infer<typeof ReporterZ>;

export const BaseDailyZ = z.object({
  id: z.number(),
  personId: z.string(),
  personName: z.string(),
  date: YmdString,
  status: DailyStatusZ,
  reporter: ReporterZ,
  draft: DraftMetaZ,
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type BaseDaily = z.infer<typeof BaseDailyZ>;

export const MealAmountZ = z.enum(['完食', '多め', '半分', '少なめ', 'なし']);
export type MealAmount = z.infer<typeof MealAmountZ>;

export const DailyADataZ = z.object({
  amActivities: StringList,
  amNotes: z.string().optional(),
  pmActivities: StringList,
  pmNotes: z.string().optional(),
  mealMain: MealAmountZ.optional(),
  mealSide: MealAmountZ.optional(),
  problemBehavior: z.enum(['あり', 'なし']).optional(),
  specialNotes: z.string().optional(),
});
export type DailyAData = z.infer<typeof DailyADataZ>;

export const PersonDailyZ = BaseDailyZ.extend({
  kind: z.literal('A'),
  data: DailyADataZ,
});
export type PersonDaily = z.infer<typeof PersonDailyZ>;

export const DailyBDataZ = z.object({
  proactive: StringList,
  skillSupports: StringList,
  stability: z.coerce.number().int().min(1).max(5).optional(),
  tags: StringList,
  incidentRefIds: StringList,
  notes: z.string().optional(),
});
export type DailyBData = z.infer<typeof DailyBDataZ>;

export const AxisDailyZ = BaseDailyZ.extend({
  kind: z.literal('B'),
  data: DailyBDataZ,
});
export type AxisDaily = z.infer<typeof AxisDailyZ>;

export const AnyDailyZ = z.discriminatedUnion('kind', [PersonDailyZ, AxisDailyZ]);
export type AnyDaily = z.infer<typeof AnyDailyZ>;

export const DailyFilterZ = z.object({
  q: TrimmedString.optional(),
  group: TrimmedString.optional(),
  status: z.union([DailyStatusZ, z.literal('all')]).default('all'),
});
export type DailyFilter = z.infer<typeof DailyFilterZ>;
