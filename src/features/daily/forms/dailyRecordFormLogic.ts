/**
 * dailyRecordFormLogic.ts
 *
 * Pure functions and constants extracted from DailyRecordForm.tsx.
 * No React dependencies — all pure logic.
 */

import type { DailyAData, PersonDaily } from '@/features/daily';
import { toLocalDateISO } from '@/utils/getNow';

// ─── Types ────────────────────────────────────────────────────────────────

export type ProblemBehaviorSuggestion = {
  selfHarm: boolean;
  violence: boolean;
  loudVoice: boolean;
  pica: boolean;
  other: boolean;
  otherDetail: string;
};

// ─── Constants ────────────────────────────────────────────────────────────

export const mealOptions = [
  { value: '完食' as const, label: '完食' },
  { value: '多め' as const, label: '多め' },
  { value: '半分' as const, label: '半分' },
  { value: '少なめ' as const, label: '少なめ' },
  { value: 'なし' as const, label: 'なし' },
] as const;

// ─── Pure functions ───────────────────────────────────────────────────────

export function buildProblemBehaviorSuggestion(
  handoffs: { message: string; category?: string }[],
): ProblemBehaviorSuggestion {
  const suggestion: ProblemBehaviorSuggestion = {
    selfHarm: false,
    violence: false,
    loudVoice: false,
    pica: false,
    other: false,
    otherDetail: '',
  };

  const text = handoffs.map((h) => h.message).join('\n');

  if (text.match(/自傷|自分を叩く|頭を打つ|自分を殴る|自分.*叩く|自分.*打つ/)) {
    suggestion.selfHarm = true;
  }
  if (
    text.match(/他害|職員.*殴る|職員.*蹴る|職員.*叩く|利用者.*殴る|利用者.*蹴る|利用者.*叩く|暴力/) &&
    !suggestion.selfHarm
  ) {
    suggestion.violence = true;
  }
  if (text.match(/大声|叫ぶ|奇声|怒鳴る/)) {
    suggestion.loudVoice = true;
  }
  if (text.match(/異食|口に入れる|拾い食い|食べてはいけないもの/)) {
    suggestion.pica = true;
  }
  if (!suggestion.selfHarm && !suggestion.violence && !suggestion.loudVoice && !suggestion.pica) {
    if (text.trim().length > 0) {
      suggestion.other = true;
      suggestion.otherDetail = '申し送り内容に基づく行動上の注意あり';
    }
  }

  return suggestion;
}

export function isProblemBehaviorEmpty(pb: DailyAData['problemBehavior'] | undefined): boolean {
  if (!pb) return true;
  return !pb.selfHarm && !pb.violence && !pb.loudVoice && !pb.pica && !pb.other && !pb.otherDetail;
}

export function createEmptyDailyRecord(): Omit<PersonDaily, 'id'> {
  return {
    personId: '',
    personName: '',
    date: toLocalDateISO(),
    status: '作成中',
    reporter: { name: '' },
    draft: { isDraft: true },
    kind: 'A',
    data: {
      amActivities: [],
      pmActivities: [],
      amNotes: '',
      pmNotes: '',
      mealAmount: '完食',
      problemBehavior: {
        selfHarm: false,
        violence: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: '',
      },
      seizureRecord: {
        occurred: false,
        time: '',
        duration: '',
        severity: undefined,
        notes: '',
      },
      specialNotes: '',
    },
  };
}

export function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function validateDailyRecordForm(formData: Omit<PersonDaily, 'id'>): Record<string, string> {
  const newErrors: Record<string, string> = {};
  if (!formData.personId) {
    newErrors.personId = '利用者の選択は必須です';
  }
  if (!formData.date) {
    newErrors.date = '日付を入力してください';
  }
  if (!formData.reporter.name.trim()) {
    newErrors.reporter = '記録者名を入力してください';
  }
  return newErrors;
}
