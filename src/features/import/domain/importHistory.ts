// ---------------------------------------------------------------------------
// importHistory — CSVインポート履歴のドメイン型とストア
//
// いつ・何件・どのファイルを取り込んだかを永続記録する。
// 監査説明 / 運用トラブル追跡 / 差分確認に必要な証跡を提供する。
// ---------------------------------------------------------------------------

/** インポート対象の種別 */
export type ImportTarget = 'users' | 'support' | 'care';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportHistoryValidationIssue = {
  field: string;
  message: string;
  severity: 'warning' | 'error';
  count: number;
};

export type ImportHistoryStatus = 'success' | 'partial' | 'failed';

export type ImportHistoryEntry = {
  id: string;
  importedAt: string;            // ISO 8601
  target: ImportTarget;          // 'users' | 'support' | 'care'
  fileName: string;
  fileSize: number;              // bytes

  // ── 結果 ──
  totalRows: number;
  importedRecords: number;
  skippedRows: number;
  errorCount: number;
  userCount: number;

  // ── バリデーション ──
  validationIssues: ImportHistoryValidationIssue[];

  // ── メタ ──
  status: ImportHistoryStatus;
  notes?: string;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'csvImport.history.v1';

/** 最大保持件数（古いものを自動削除） */
const MAX_ENTRIES = 100;

function generateId(): string {
  return `imphist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readFromStorage(): ImportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ImportHistoryEntry[];
  } catch {
    return [];
  }
}

function writeToStorage(entries: ImportHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const importHistoryStore = {
  /**
   * 新しいインポート履歴エントリを追加する。
   * id が未指定の場合は自動生成する。
   */
  addEntry(entry: Omit<ImportHistoryEntry, 'id'> & { id?: string }): ImportHistoryEntry {
    const full: ImportHistoryEntry = {
      ...entry,
      id: entry.id ?? generateId(),
    };

    const entries = readFromStorage();
    // 新しいものを先頭に追加
    entries.unshift(full);

    // 最大件数を超えたら古いものを削除
    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }

    writeToStorage(entries);
    return full;
  },

  /** すべてのエントリを取得（新しい順） */
  getAll(): ImportHistoryEntry[] {
    return readFromStorage();
  },

  /** ターゲット別にフィルターして取得 */
  getByTarget(target: ImportTarget): ImportHistoryEntry[] {
    return readFromStorage().filter((e) => e.target === target);
  },

  /** 最新 n 件を取得 */
  getLatest(n: number): ImportHistoryEntry[] {
    return readFromStorage().slice(0, n);
  },

  /** すべての履歴を削除 */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
