/**
 * DataProvider Observability Store
 * 
 * データ層（IDataProvider / Repositories）の動作状況を中央管理し、
 * 開発パネルや UI 上でのステータス表示、テレメトリ出力を可能にする。
 */
import { create } from 'zustand';

export type ProviderType = 'sharepoint' | 'memory' | 'local';

export type ResourceStatus = 
  | 'resolved'          // 正常解決
  | 'missing_optional'  // 任意リストが不在
  | 'missing_required'  // 必須リストが不在（エラー）
  | 'fallback_triggered' // 他のリストで代用中
  | 'schema_mismatch'   // スキーマ（列）が不足している
  | 'pending';          // 未解決（初期状態）

export interface FieldResolutionInfo {
  key: string;
  resolvedName?: string;
  candidates: string[];
  isEssential: boolean;
  isResolved: boolean;
}

export interface ResourceResolutionState {
  resourceName: string;
  status: ResourceStatus;
  resolvedTitle: string;
  fields: FieldResolutionInfo[];
  lastAccessedAt: string;
  error?: string;
  fallbackFrom?: string;
}

interface ObservabilityState {
  currentProvider: ProviderType | null;
  resolutions: Record<string, ResourceResolutionState>;
  
  isPanelOpen: boolean;
  activeTab: string;
  focusResourceName?: string;

  // Actions
  setProvider: (type: ProviderType) => void;
  reportResolution: (state: ResourceResolutionState) => void;
  clearResolutions: () => void;
  openPanel: (options?: { tab?: string; resourceName?: string }) => void;
  setPanelOpen: (open: boolean) => void;
  setPanelTab: (tab: string) => void;
}

/**
 * Zustand Store for DataProvider Observability
 */
export const useDataProviderObservabilityStore = create<ObservabilityState>((set) => ({
  currentProvider: null,
  resolutions: {},
  isPanelOpen: false,
  activeTab: 'obs',
  focusResourceName: undefined,

  setProvider: (type) => set({ currentProvider: type }),

  reportResolution: (state) => set((prev) => ({
    resolutions: {
      ...prev.resolutions,
      [state.resourceName]: state
    }
  })),

  clearResolutions: () => set({ resolutions: {} }),

  openPanel: (options) => set({ 
    isPanelOpen: true, 
    activeTab: options?.tab ?? 'obs',
    focusResourceName: options?.resourceName 
  }),

  setPanelOpen: (open) => set({ isPanelOpen: open }),

  setPanelTab: (tab) => set({ activeTab: tab }),
}));

/**
 * リソース解決結果をストアに報告する便利なラッパー
 */
export function reportResourceResolution<T extends string>(params: {
  resourceName: string;
  resolvedTitle: string;
  fieldStatus: Record<T, { resolvedName?: string; candidates: string[] }>;
  essentials: T[];
  error?: string;
  fallbackFrom?: string;
}) {
  const { resourceName, resolvedTitle, fieldStatus, essentials, error, fallbackFrom } = params;
  
  const fields = Object.entries(fieldStatus).map(([key, info]) => {
    const i = info as { resolvedName?: string; candidates: string[] };
    return {
      key,
      resolvedName: i.resolvedName,
      candidates: i.candidates,
      isEssential: essentials.includes(key as T),
      isResolved: !!i.resolvedName
    };
  });

  const missingEssentials = fields.filter(f => f.isEssential && !f.isResolved);
  const hasSchemaMismatch = fields.some(f => !f.isResolved && !f.isEssential);

  let status: ResourceStatus = 'resolved';
  if (error) {
    status = 'missing_required';
  } else if (missingEssentials.length > 0) {
    status = 'missing_required'; // 必須フィールド欠損も実質 required missing
  } else if (fallbackFrom) {
    status = 'fallback_triggered';
  } else if (hasSchemaMismatch) {
    status = 'schema_mismatch';
  }

  useDataProviderObservabilityStore.getState().reportResolution({
    resourceName,
    status,
    resolvedTitle,
    fields,
    lastAccessedAt: new Date().toISOString(),
    error,
    fallbackFrom
  });
}
