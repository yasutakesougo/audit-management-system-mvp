import type {
  ToiletRecord,
  ToiletRecordCorrectionPatch,
  ToiletRecordInput,
  IToiletRecordRepository,
} from './types';
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

const nextUpdatedAt = (currentUpdatedAt: string): string => {
  const now = new Date();
  const current = Date.parse(currentUpdatedAt);
  if (!Number.isNaN(current) && now.getTime() <= current) {
    return new Date(current + 1).toISOString();
  }
  return now.toISOString();
};

export class LocalStorageToiletRecordRepository implements IToiletRecordRepository {
  async listByDate(dateIso: string): Promise<ToiletRecord[]> {
    return readStorage().records
      .filter((record) => !record.isDeleted && toLocalDateISO(new Date(record.occurredAt)) === dateIso)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async create(input: ToiletRecordInput): Promise<ToiletRecord> {
    const now = new Date().toISOString();
    const record: ToiletRecord = {
      id: `toilet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: input.userId,
      recordDate: toLocalDateISO(new Date(input.occurredAt)),
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
  }

  async update(recordId: string, patch: ToiletRecordCorrectionPatch): Promise<ToiletRecord> {
    const storage = readStorage();
    const index = storage.records.findIndex((record) => record.id === recordId && !record.isDeleted);
    if (index < 0) {
      throw new Error(`[ToiletRecordRepo] record not found: ${recordId}`);
    }

    const current = storage.records[index];
    const updated: ToiletRecord = {
      ...current,
      toiletType: patch.toiletType ?? current.toiletType,
      amount: patch.amount ?? current.amount,
      memo: patch.memo?.trim() ?? current.memo,
      updatedAt: nextUpdatedAt(current.updatedAt),
    };

    writeStorage({
      version: 1,
      records: storage.records.map((record, recordIndex) => (recordIndex === index ? updated : record)),
    });
    return updated;
  }
}
