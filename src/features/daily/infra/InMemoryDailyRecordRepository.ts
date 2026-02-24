import type {
  DailyRecordRepository,
  SaveDailyRecordInput,
  DailyRecordItem,
  DailyRecordRepositoryListParams,
  DailyRecordRepositoryMutationParams,
} from '../domain/DailyRecordRepository';
import type { UserRowData } from '../hooks/useTableDailyRecordForm';

/**
 * Seed data for InMemory repository
 */
type InMemoryDailyRecordSeed = {
  records?: DailyRecordItem[];
};

/**
 * Check if date is within range (inclusive)
 */
const isDateInRange = (date: string, startDate: string, endDate: string): boolean => {
  return date >= startDate && date <= endDate;
};

/**
 * Format date as YYYY-MM-DD in local timezone
 */
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Subtract days from date
 */
const subtractDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
};

/**
 * Create default demo daily records
 * Generates sample data for testing and demo mode
 */
const createDefaultRecords = (): DailyRecordItem[] => {
  const today = new Date('2026-02-24'); // Current date from context
  const records: DailyRecordItem[] = [];

  // Generate 5 days of sample data (today and 4 days back)
  for (let i = 0; i < 5; i++) {
    const recordDate = formatDateLocal(subtractDays(today, i));
    const dayOfWeek = subtractDays(today, i).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Sample user rows with realistic data
    const userRows: UserRowData[] = [
      {
        userId: 'user-001',
        userName: '田中 太郎',
        amActivity: isWeekend ? '創作活動' : '散歩',
        pmActivity: isWeekend ? 'レクリエーション' : '個別作業',
        lunchAmount: i % 3 === 0 ? '完食' : '8割',
        problemBehavior: {
          selfHarm: false,
          violence: false,
          loudVoice: i === 0, // Only on most recent day
          pica: false,
          other: false,
        },
        specialNotes: i === 0 ? '午後から少し疲れている様子' : '',
      },
      {
        userId: 'user-002',
        userName: '佐藤 花子',
        amActivity: '音楽療法',
        pmActivity: isWeekend ? '自由時間' : '手工芸',
        lunchAmount: '完食',
        problemBehavior: {
          selfHarm: false,
          violence: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        specialNotes: '',
      },
      {
        userId: 'user-003',
        userName: '鈴木 次郎',
        amActivity: isWeekend ? '外出支援' : '就労訓練',
        pmActivity: '読書',
        lunchAmount: i === 2 ? '半分' : '完食',
        problemBehavior: {
          selfHarm: false,
          violence: false,
          loudVoice: false,
          pica: false,
          other: i === 2, // Problem on day -2
        },
        specialNotes: i === 2 ? '食欲が少ないため様子観察' : '',
      },
    ];

    // Skip weekend records for user-004
    if (!isWeekend) {
      userRows.push({
        userId: 'user-004',
        userName: '山田 美咲',
        amActivity: '園芸活動',
        pmActivity: '体操',
        lunchAmount: '8割',
        problemBehavior: {
          selfHarm: false,
          violence: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        specialNotes: '',
      });
    }

    records.push({
      id: `demo-daily-${recordDate}`,
      date: recordDate,
      reporter: {
        name: i % 2 === 0 ? '高橋 健' : '小林 美由紀',
        role: i % 2 === 0 ? '生活支援員' : 'サービス管理責任者',
      },
      userRows,
      createdAt: new Date(recordDate + 'T17:30:00+09:00').toISOString(),
      modifiedAt: new Date(recordDate + 'T17:30:00+09:00').toISOString(),
    });
  }

  return records;
};

/**
 * In-Memory implementation of DailyRecordRepository
 * 
 * Used for:
 * - Demo mode (VITE_DEMO_MODE=1)
 * - Unit tests
 * - Development without SharePoint access
 * 
 * Data is stored in memory and lost on page refresh.
 * See SharePointDailyRecordRepository for persistent implementation.
 */
export class InMemoryDailyRecordRepository implements DailyRecordRepository {
  private data: Map<string, DailyRecordItem>;
  private nextId = 1000;

  constructor(seed: InMemoryDailyRecordSeed = {}) {
    this.data = new Map();

    // Initialize with seed data or default demo records
    const initialRecords = seed.records ?? createDefaultRecords();
    initialRecords.forEach((record) => {
      this.data.set(record.date, { ...record });
    });
  }

  /**
   * Save a daily record
   * Overwrites existing record for the same date
   */
  async save(
    input: SaveDailyRecordInput,
    params?: DailyRecordRepositoryMutationParams,
  ): Promise<void> {
    if (params?.signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const now = new Date().toISOString();
    const existingRecord = this.data.get(input.date);

    const record: DailyRecordItem = {
      ...input,
      id: existingRecord?.id ?? `inmem-daily-${this.nextId++}`,
      createdAt: existingRecord?.createdAt ?? now,
      modifiedAt: now,
    };

    this.data.set(input.date, record);
  }

  /**
   * Load a daily record for a specific date
   * Returns null if not found
   */
  async load(date: string): Promise<DailyRecordItem | null> {
    const record = this.data.get(date);
    return record ? { ...record } : null;
  }

  /**
   * List daily records within a date range
   * Returns records sorted by date (newest first)
   */
  async list(params: DailyRecordRepositoryListParams): Promise<DailyRecordItem[]> {
    if (params.signal?.aborted) {
      return [];
    }

    const { startDate, endDate } = params.range;
    const results: DailyRecordItem[] = [];

    for (const [date, record] of this.data.entries()) {
      if (isDateInRange(date, startDate, endDate)) {
        results.push({ ...record });
      }
    }

    // Sort by date descending (newest first)
    results.sort((a, b) => b.date.localeCompare(a.date));

    return results;
  }

  /**
   * Clear all records (for testing)
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Get record count (for testing/debugging)
   */
  size(): number {
    return this.data.size;
  }
}

/**
 * Singleton instance for demo/test usage
 */
export const inMemoryDailyRecordRepository = new InMemoryDailyRecordRepository();
