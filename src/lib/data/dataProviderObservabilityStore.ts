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
  | 'schema_mismatch'   // スキーマ（必須列）が不足している
  | 'schema_warning'    // 一部非必須列（optional）の名前解決ができていない
  | 'pending';          // 未解決（初期状態）

export interface FieldResolutionInfo {
  key: string;
  resolvedName?: string;
  candidates: string[];
  isEssential: boolean;
  isResolved: boolean;
  isSilent: boolean;
}

export interface ResourceResolutionState {
  resourceName: string;
  status: ResourceStatus;
  resolvedTitle: string;
  fields: FieldResolutionInfo[];
  lastAccessedAt: string;
  error?: string;
  fallbackFrom?: string;
  httpStatus?: number;
}

interface ObservabilityState {
  currentProvider: ProviderType | null;
  currentUser: string | null;
  resolutions: Record<string, ResourceResolutionState>;

  isPanelOpen: boolean;
  activeTab: string;
  focusResourceName?: string;

  // Actions
  setProvider: (type: ProviderType) => void;
  setCurrentUser: (user: string | null) => void;
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
  currentUser: null,
  resolutions: {},
  isPanelOpen: false,
  activeTab: 'obs',
  focusResourceName: undefined,

  setProvider: (type) => set((state) => {
    if (state.currentProvider === type) return state;
    return { currentProvider: type };
  }),

  setCurrentUser: (user) => set((state) => {
    if (state.currentUser === user) return state;
    return { currentUser: user };
  }),

  reportResolution: (state) => set((prev) => {
    const existing = prev.resolutions[state.resourceName];
    if (existing) {
      // 致命的な差異がある場合のみ更新
      const isSameStatus = existing.status === state.status;
      const isSameError = (existing.error ?? '') === (state.error ?? '');
      const isSameFallback = (existing.fallbackFrom ?? '') === (state.fallbackFrom ?? '');
      
      // フィールドリストの比較 (順序に依存しないようにソートして比較)
      const getFieldsSig = (fs: FieldResolutionInfo[]) => 
        fs.map(f => `${f.key}:${f.resolvedName}:${f.isResolved}`).sort().join('|');
      
      const isSameFields = getFieldsSig(existing.fields) === getFieldsSig(state.fields);

      if (isSameStatus && isSameError && isSameFallback && isSameFields) {
        // 変化がない場合は、時刻更新のためだけに全体を再描画させない
        return prev;
      }
    }

    return {
      resolutions: {
        ...prev.resolutions,
        [state.resourceName]: state
      }
    };
  }),

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
export interface ResourceResolutionReport {
  resourceName: string;
  lifecycle?: 'required' | 'optional';
  resolvedTitle: string;
  fieldStatus: Record<string, { resolvedName?: string; candidates: string[]; isSilent?: boolean }>;
  essentials: string[];
  error?: string;
  fallbackFrom?: string;
  httpStatus?: number;
}

/**
 * Report a resolution attempt to the observability store
 */
/**
 * Report a resolution attempt to the observability store
 */
export function reportResourceResolution(report: ResourceResolutionReport): void {
  const {
    resourceName,
    lifecycle = 'required',
    resolvedTitle,
    fieldStatus,
    essentials,
    error,
    fallbackFrom,
    httpStatus,
  } = report;

  const fields: FieldResolutionInfo[] = Object.entries(fieldStatus).map(([key, info]) => ({
    key,
    candidates: info.candidates,
    resolvedName: info.resolvedName,
    isResolved: !!info.resolvedName,
    isEssential: essentials.includes(key),
    isSilent: !!info.isSilent
  }));

  const missingEssentials = fields.filter(f => f.isEssential && !f.isResolved);

  let status: ResourceStatus = 'resolved';
  if (error || missingEssentials.length > 0) {
    status = lifecycle === 'required' ? 'missing_required' : 'schema_mismatch';
  } else if (fallbackFrom) {
    status = 'fallback_triggered';
  } else if (fields.some(f => !f.isResolved && !f.isSilent)) {
    status = 'schema_warning';
  }

  // 1. 同一性の判定用シグネチャ生成
  // key, resolvedName, isResolved, isSilent, isEssential すべてを網羅
  const getFieldsSig = (fs: FieldResolutionInfo[]) => 
    fs.map(f => `${f.key}:${f.resolvedName}:${f.isResolved}:${f.isSilent}:${f.isEssential}`).sort().join('|');
  const nextSig = getFieldsSig(fields);

  // 2. 現在のストアの状態を確認し、機能的な変化がない場合は早期リターン（setTimeoutすら発行しない）
  const existing = useDataProviderObservabilityStore.getState().resolutions[resourceName];
  if (existing) {
    const isSameStatus = existing.status === status;
    const isSameError = (existing.error ?? '') === (error ?? '');
    const isSameFallback = (existing.fallbackFrom ?? '') === (fallbackFrom ?? '');
    const isSameFields = getFieldsSig(existing.fields) === nextSig;
    
    if (isSameStatus && isSameFields && isSameError && isSameFallback) {
      return; 
    }
  }

  // 3. 変化がある場合のみ、非同期（レンダリングサイクル外）で更新を予約
  setTimeout(() => {
    useDataProviderObservabilityStore.getState().reportResolution({
      resourceName,
      status,
      resolvedTitle,
      fields,
      lastAccessedAt: new Date().toISOString(),
      error,
      fallbackFrom,
      httpStatus,
    });
  }, 0);
}
