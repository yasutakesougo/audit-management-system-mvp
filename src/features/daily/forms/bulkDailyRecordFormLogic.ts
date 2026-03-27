import { toLocalDateISO } from '@/utils/getNow';
/**
 * bulkDailyRecordFormLogic.ts
 *
 * Pure functions, types and constants extracted from BulkDailyRecordForm.tsx.
 * No React dependencies — all pure logic.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface BulkActivityData {
  date: string;
  reporter: {
    name: string;
    role: string;
  };
  commonActivities: {
    amActivities: string[];
    pmActivities: string[];
    amNotes: string;
    pmNotes: string;
  };
  individualNotes: Record<string, {
    amNotes?: string;
    pmNotes?: string;
    specialNotes?: string;
    problemBehavior?: {
      selfHarm: boolean;
      otherInjury: boolean;
      loudVoice: boolean;
      pica: boolean;
      other: boolean;
      otherDetail: string;
    };
  }>;
}

export interface BulkDailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: BulkActivityData, selectedUserIds: string[]) => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────

export const REPORTER_ROLE_OPTIONS = [
  { value: '生活支援員', label: '生活支援員' },
  { value: '管理者', label: '管理者' },
  { value: '看護師', label: '看護師' },
  { value: '其他', label: '其他' },
] as const;

// ─── Pure functions ───────────────────────────────────────────────────────

export function createEmptyBulkActivityData(): BulkActivityData {
  return {
    date: toLocalDateISO(),
    reporter: {
      name: '',
      role: '生活支援員',
    },
    commonActivities: {
      amActivities: [],
      pmActivities: [],
      amNotes: '',
      pmNotes: '',
    },
    individualNotes: {},
  };
}

export type UserLike = {
  Id?: number | string;
  UserID?: string | null;
  FullName?: string | null;
  Furigana?: string | null;
  userId?: string | null;
  name?: string | null;
  furigana?: string | null;
  id?: number | string;
};

export function filterUsers<T extends UserLike>(users: T[], query: string): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return users;
  return users.filter((user) => {
    const name = user.FullName ?? user.name;
    const userId = user.UserID ?? user.userId;
    const furigana = user.Furigana ?? user.furigana;

    return name?.toLowerCase().includes(trimmed)
      || userId?.toLowerCase().includes(trimmed)
      || furigana?.toLowerCase().includes(trimmed);
  });
}
