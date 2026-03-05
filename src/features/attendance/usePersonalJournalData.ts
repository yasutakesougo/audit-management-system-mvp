/**
 * usePersonalJournalData — ハイブリッドデータフック
 *
 * 当日分は useAttendanceStore の実（デモ）データを使い、
 * 残りの日はデモ生成データで補完して月間 PersonalDayEntry[] を構築する。
 */
import type { MealAmount } from '@/domain/daily/types';
import type { AttendanceVisit } from '@/features/attendance/attendance.logic';
import { mapVisitToJournalEntry, type PersonalDayEntry } from '@/features/attendance/journalMapper';
import { useAttendanceStore } from '@/features/attendance/store';
import type { TransportMethod } from '@/features/attendance/transportMethod';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import { useMemo } from 'react';

// ── Demo data helpers ───────────────────────────────────────────────────────

const MEAL_OPTIONS: MealAmount[] = ['完食', '多め', '半分', '少なめ', 'なし'];
const AM_ACTIVITIES = ['軽作業', 'ストレッチ', '創作活動', '清掃活動', '園芸', '調理実習'];
const PM_ACTIVITIES = ['レクリエーション', '個別支援', '散歩', '音楽活動', 'PC作業', '読書'];
const TRANSPORT_METHODS: TransportMethod[] = ['office_shuttle', 'family', 'self', 'guide_helper'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 特定日のデモ AttendanceVisit を生成
 */
function generateDemoVisit(
  userId: string,
  year: number,
  month: number,
  day: number,
  rand: () => number,
): { visit: AttendanceVisit; extra: { mealAmount?: MealAmount; amActivity: string; pmActivity: string; restraint: boolean; selfHarm: boolean; otherInjury: boolean; seizure: boolean; specialNotes: string; hasAttachment: boolean } } | null {
  const date = new Date(year, month - 1, day);
  const dowIdx = date.getDay();

  // 土日スキップ
  if (dowIdx === 0 || dowIdx === 6) return null;

  const isAbsent = rand() < 0.12;
  const recordDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (isAbsent) {
    return {
      visit: {
        userCode: userId,
        status: '当日欠席',
        recordDate,
        cntAttendIn: 0,
        cntAttendOut: 0,
        transportTo: false,
        transportFrom: false,
        isEarlyLeave: false,
        absentMorningContacted: rand() < 0.7,
        absentMorningMethod: '電話',
        eveningChecked: rand() < 0.5,
        eveningNote: '',
        isAbsenceAddonClaimable: false,
        providedMinutes: 0,
      },
      extra: {
        amActivity: '',
        pmActivity: '',
        restraint: false,
        selfHarm: false,
        otherInjury: false,
        seizure: false,
        specialNotes: rand() < 0.3 ? '体調不良のため欠席' : '',
        hasAttachment: false,
      },
    };
  }

  const isLate = rand() < 0.08;
  const arrivalHour = isLate ? 10 : 9;
  const arrivalMin = Math.floor(rand() * 30);
  const departHour = 15 + Math.floor(rand() * 2);
  const departMin = Math.floor(rand() * 60);

  // Build JST timestamps
  const checkInJST = `${recordDate}T${String(arrivalHour).padStart(2, '0')}:${String(arrivalMin).padStart(2, '0')}:00+09:00`;
  const checkOutJST = `${recordDate}T${String(departHour).padStart(2, '0')}:${String(departMin).padStart(2, '0')}:00+09:00`;

  const toMethod = TRANSPORT_METHODS[Math.floor(rand() * TRANSPORT_METHODS.length)];
  const fromMethod = TRANSPORT_METHODS[Math.floor(rand() * TRANSPORT_METHODS.length)];

  return {
    visit: {
      userCode: userId,
      status: '退所済',
      recordDate,
      cntAttendIn: 1,
      cntAttendOut: 1,
      transportTo: toMethod === 'office_shuttle',
      transportFrom: fromMethod === 'office_shuttle',
      transportToMethod: toMethod,
      transportFromMethod: fromMethod,
      isEarlyLeave: rand() < 0.05,
      absentMorningContacted: false,
      absentMorningMethod: '',
      eveningChecked: false,
      eveningNote: '',
      isAbsenceAddonClaimable: false,
      providedMinutes: (departHour * 60 + departMin) - (arrivalHour * 60 + arrivalMin),
      checkInAt: new Date(checkInJST).toISOString(),
      checkOutAt: new Date(checkOutJST).toISOString(),
    },
    extra: {
      mealAmount: MEAL_OPTIONS[Math.floor(rand() * MEAL_OPTIONS.length)],
      amActivity: AM_ACTIVITIES[Math.floor(rand() * AM_ACTIVITIES.length)],
      pmActivity: PM_ACTIVITIES[Math.floor(rand() * PM_ACTIVITIES.length)],
      restraint: rand() < 0.03,
      selfHarm: rand() < 0.05,
      otherInjury: rand() < 0.04,
      seizure: rand() < 0.03,
      specialNotes: rand() < 0.12 ? '午後より気分変動あり。落ち着いてから参加再開。' : '',
      hasAttachment: rand() < 0.06,
    },
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePersonalJournalDataReturn {
  entries: PersonalDayEntry[];
}

export function usePersonalJournalData(
  userId: string,
  year: number,
  month: number,
  handoffRecords?: HandoffRecord[],
): UsePersonalJournalDataReturn {
  const { visits: storeVisits } = useAttendanceStore();

  const entries = useMemo(() => {
    const daysCount = getDaysInMonth(year, month);
    const seed = userId.charCodeAt(userId.length - 1) * 1000 + year * 100 + month;
    const rand = seededRandom(seed);
    const result: PersonalDayEntry[] = [];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let d = 1; d <= daysCount; d++) {
      const date = new Date(year, month - 1, d);
      const dowIdx = date.getDay();

      // 土日スキップ
      if (dowIdx === 0 || dowIdx === 6) {
        // advance rand to keep seed consistency
        rand(); rand(); rand(); rand(); rand();
        continue;
      }

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      // 当日 → ストアデータを優先
      if (isToday && storeVisits[userId]) {
        const snapshot = storeVisits[userId];
        // ストアの AttendanceVisitSnapshot を AttendanceVisit に拡張
        const visit: AttendanceVisit = {
          userCode: snapshot.userCode,
          status: (snapshot.status as AttendanceVisit['status']) || '未',
          recordDate: dateStr,
          cntAttendIn: snapshot.status === '通所中' || snapshot.status === '退所済' ? 1 : 0,
          cntAttendOut: snapshot.status === '退所済' ? 1 : 0,
          transportTo: false,
          transportFrom: false,
          isEarlyLeave: snapshot.isEarlyLeave ?? false,
          absentMorningContacted: false,
          absentMorningMethod: '',
          eveningChecked: snapshot.eveningChecked ?? false,
          eveningNote: '',
          isAbsenceAddonClaimable: false,
          providedMinutes: snapshot.providedMinutes ?? 0,
        };

        result.push(mapVisitToJournalEntry(visit, date));
        // advance rand to keep seed consistency
        rand(); rand(); rand(); rand(); rand();
        continue;
      }

      // その他の日 → デモデータ生成
      const generated = generateDemoVisit(userId, year, month, d, rand);
      if (!generated) continue;

      result.push(mapVisitToJournalEntry(generated.visit, date, generated.extra));
    }

    // ── Handoff overlay: merge 申し送り messages into specialNotes ──
    if (handoffRecords && handoffRecords.length > 0) {
      // Build date → messages map for this user
      const notesByDate = new Map<string, string[]>();
      for (const h of handoffRecords) {
        if (h.userCode !== userId) continue;
        // Extract date from createdAt (ISO) as YYYY-MM-DD in JST
        const d = new Date(h.createdAt);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const prefix = h.category !== 'その他' ? `【${h.category}】` : '';
        const msg = `${prefix}${h.message}`;
        const arr = notesByDate.get(dateKey) ?? [];
        arr.push(msg);
        notesByDate.set(dateKey, arr);
      }

      // Overlay onto entries
      for (const entry of result) {
        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}`;
        const handoffNotes = notesByDate.get(dateKey);
        if (handoffNotes && handoffNotes.length > 0) {
          const combined = handoffNotes.join(' / ');
          entry.specialNotes = entry.specialNotes
            ? `${entry.specialNotes} / ${combined}`
            : combined;
        }
      }
    }

    return result;
  }, [userId, year, month, storeVisits, handoffRecords]);

  return { entries };
}
