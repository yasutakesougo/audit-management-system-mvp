import type { ToiletRecord, ToiletRecordInput } from './types';
import { toLocalDateISO } from '@/utils/getNow';

const STORAGE_KEY = 'kiosk.toiletRecords.v1';

type StorageShape = {
  version: 1;
  records: ToiletRecord[];
};

const emptyStorage = (): StorageShape => ({ version: 1, records: [] });

const readStorage = (): StorageShape => {
  if (typeof window === 'undefined') return emptyStorage();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStorage();
    const parsed = JSON.parse(raw) as Partial<StorageShape>;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) return emptyStorage();
    return { version: 1, records: parsed.records };
  } catch {
    return emptyStorage();
  }
};

const writeStorage = (shape: StorageShape): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shape));
};

export const listToiletRecordsByDate = (dateIso: string): ToiletRecord[] => {
  return readStorage().records
    .filter((record) => !record.isDeleted && toLocalDateISO(new Date(record.occurredAt)) === dateIso)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
};

export const createToiletRecord = (input: ToiletRecordInput): ToiletRecord => {
  const now = new Date().toISOString();
  const record: ToiletRecord = {
    id: `toilet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    occurredAt: input.occurredAt,
    toiletType: input.toiletType,
    amount: input.amount,
    memo: input.memo?.trim() ?? '',
    recorderName: input.recorderName?.trim() ?? '',
    source: 'kiosk',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  const storage = readStorage();
  writeStorage({ version: 1, records: [record, ...storage.records] });
  return record;
};
