export type NurseWeightGroup = 'thu' | 'fri';

export type NurseUser = {
  id: string;
  name: string;
  furigana?: string;
  isActive?: boolean;
  weightGroup?: NurseWeightGroup;
};

const collator = new Intl.Collator('ja', { sensitivity: 'base', numeric: true });

export const NURSE_USERS: NurseUser[] = [
  { id: 'I015', name: '山田 太郎', furigana: 'やまだ たろう', isActive: true, weightGroup: 'thu' as const },
  { id: 'I022', name: '中村 裕樹', furigana: 'なかむら ひろき', isActive: true, weightGroup: 'fri' as const },
  { id: 'I031', name: '佐々木 花', furigana: 'ささき はな', isActive: true, weightGroup: 'thu' as const },
  { id: 'I044', name: '森川 智也', furigana: 'もりかわ ともや', isActive: true, weightGroup: 'fri' as const },
  { id: 'I052', name: '田中 美咲', furigana: 'たなか みさき', isActive: false, weightGroup: 'thu' as const },
].sort((a, b) => collator.compare(a.furigana ?? a.name, b.furigana ?? b.name));

if (process.env.NODE_ENV !== 'production') {
  const ids = new Set<string>();
  for (const user of NURSE_USERS) {
    if (ids.has(user.id)) {
      // eslint-disable-next-line no-console
      console.warn('[NURSE_USERS] duplicate id:', user.id);
    }
    ids.add(user.id);
  }
}
