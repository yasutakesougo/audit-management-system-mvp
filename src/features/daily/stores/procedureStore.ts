import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { useCallback, useSyncExternalStore } from 'react';

export type ProcedureItem = ScheduleItem;

const BASE_STEPS: ProcedureItem[] = [
  { id: 'base-0900', time: '09:00', activity: '朝の受け入れ', instruction: '視線を合わせて挨拶。体調チェックシート記入。', isKey: true },
  { id: 'base-0915', time: '09:15', activity: '持ち物整理', instruction: 'ロッカーへの収納を支援。手順書を提示。', isKey: false },
  { id: 'base-1000', time: '10:00', activity: '作業活動', instruction: '作業手順の提示。失敗時は新しい部材を渡す。', isKey: true },
  { id: 'base-1130', time: '11:30', activity: '昼食準備', instruction: '手洗い場へ誘導。', isKey: false },
  { id: 'base-1200', time: '12:00', activity: '昼食', instruction: '誤嚥に注意して見守り。', isKey: true },
  { id: 'base-1300', time: '13:00', activity: '休憩', instruction: 'リラックスできる環境を提供。', isKey: false },
  { id: 'base-1500', time: '15:00', activity: '掃除', instruction: '担当箇所の清掃を一緒に行う。', isKey: false },
  { id: 'base-1545', time: '15:45', activity: '帰りの会', instruction: '一日の振り返り。ポジティブなフィードバック。', isKey: true }
];

const cache = new Map<string, ProcedureItem[]>();
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const generateProcedures = (userId: string): ProcedureItem[] => {
  if (cache.has(userId)) return cache.get(userId)!;
  const numericId = parseInt(userId.replace(/\D+/g, ''), 10) || 0;
  const isSpecial = numericId % 2 === 0;
  const userProcedure = BASE_STEPS.map((step) => ({
    ...step,
    instruction: isSpecial && step.isKey ? `【個別配慮】${step.instruction} ※絵カード必須` : step.instruction,
    time: step.time
  }));
  cache.set(userId, userProcedure);
  return userProcedure;
};

const getSnapshot = () => cache;

export function useProcedureStore() {
  const store = useSyncExternalStore(subscribe, getSnapshot);

  const getByUser = useCallback((userId: string) => {
    if (!userId) return BASE_STEPS;
    if (store.has(userId)) return store.get(userId)!;
    return generateProcedures(userId);
  }, [store]);

  const save = useCallback((userId: string, items: ProcedureItem[]) => {
    if (!userId) return;
    cache.set(userId, items);
    emit();
  }, []);

  return {
    getByUser,
    save
  } as const;
}
