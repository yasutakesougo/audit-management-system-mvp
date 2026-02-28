/**
 * 申し送りタイムライン管理フック
 *
 * v1.0: localStorage mock実装
 * v1.1: 時間帯フィルタ対応（Step 7B）
 * v2.0: SharePoint API対応（Phase 8A）
 * 後でSharePoint API実装に差し替え可能な設計
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateTitleFromMessage } from './generateTitleFromMessage';
import { useHandoffApi } from './handoffApi';
import { handoffConfig } from './handoffConfig';
import {
    HANDOFF_TIME_FILTER_PRESETS,
    HandoffDayScope,
    HandoffRecord,
    HandoffTimeFilter,
    NewHandoffInput,
} from './handoffTypes';

const STORAGE_KEY = 'handoff.timeline.dev.v1';

type HandoffTimelineState = {
  todayHandoffs: HandoffRecord[];
  loading: boolean;
  error: string | null;
};

/**
 * 日付キーを生成（YYYY-MM-DD形式）
 */
function getTodayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 日付スコープに応じた日付キーを取得（Step 7C）
 */
function getDateKeyForScope(dayScope: HandoffDayScope): string | null {
  const now = new Date();
  if (dayScope === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return getTodayKey(yesterday);
  }
  if (dayScope === 'week') {
    return null;
  }
  return getTodayKey(now);
}

function getRecentDateKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let offset = 0; offset < days; offset += 1) {
    const target = new Date(now);
    target.setDate(now.getDate() - offset);
    keys.push(getTodayKey(target));
  }
  return keys;
}

type StorageShape = Record<string, HandoffRecord[]>;

/**
 * localStorage からデータを読み込み
 */
function loadStorage(): StorageShape {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StorageShape;
  } catch {
    return {};
  }
}

/**
 * localStorage にデータを保存
 */
function saveStorage(data: StorageShape) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 保存失敗は非致命的エラーとして処理
    console.warn('Failed to save handoff data to localStorage');
  }
}

/**
 * 一意IDを生成
 */
function generateId(): number {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // UUIDのハッシュから数値IDを生成
    const uuid = crypto.randomUUID();
    const hash = uuid.replace(/-/g, '').slice(0, 8);
    return parseInt(hash, 16);
  }

  // フォールバック: タイムスタンプベース
  return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * 申し送りタイムライン管理フック（Step 7C: dayScope対応）
 *
 * @param timeFilter 時間帯フィルタ（全て/朝〜午前/午後〜夕方）
 * @param dayScope 日付スコープ（今日/昨日）
 * @returns 申し送りデータと操作関数（フィルタ適用済み）
 */
export function useHandoffTimeline(
  timeFilter: HandoffTimeFilter = 'all',
  dayScope: HandoffDayScope = 'today'
) {
  const handoffApi = useHandoffApi(); // フックでAPIインスタンスを取得

  const [state, setState] = useState<HandoffTimelineState>({
    todayHandoffs: [],
    loading: true,
    error: null,
  });

  const dateKey = getDateKeyForScope(dayScope);

  /**
   * 指定日の申し送りデータを読み込み（Phase 8A: 2モード対応）
   */
  const loadToday = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let list: HandoffRecord[];

      if (handoffConfig.storage === 'sharepoint') {
        // SharePoint API モード
        list = await handoffApi.getHandoffRecords(dayScope, timeFilter);
      } else {
        // localStorage モード（開発用）
        const store = loadStorage();
        const sourceLists = dayScope === 'week'
          ? getRecentDateKeys(7).map(key => store[key] ?? [])
          : [store[dateKey ?? getTodayKey()] ?? []];

        list = sourceLists
          .flat()
          .slice()
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      }

      setState({
        todayHandoffs: list,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        todayHandoffs: [],
        loading: false,
        error: handoffConfig.storage === 'sharepoint'
          ? 'SharePoint からのデータ取得に失敗しました'
          : 'ローカルデータの読み込みに失敗しました',
      });
      console.error('[handoff] Load failed:', error);
    }
  }, [dateKey, dayScope, timeFilter]);

  /**
   * 新規申し送りを作成（Phase 8A: 2モード対応）
   */
  const createHandoff = useCallback(
    async (input: NewHandoffInput) => {
      const now = new Date();

      let newRecord: HandoffRecord;

      if (handoffConfig.storage === 'sharepoint') {
        // SharePoint API モード
        try {
          newRecord = await handoffApi.createHandoffRecord(input);

          // 楽観的更新: UIに即座反映
          setState(prev => ({
            ...prev,
            todayHandoffs: [newRecord, ...prev.todayHandoffs],
          }));
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: '申し送りの作成に失敗しました',
          }));
          console.error('[handoff] SharePoint create failed:', error);
          throw new Error('申し送りの作成に失敗しました');
        }
      } else {
        // localStorage モード（開発用）
        const id = generateId();

        newRecord = {
          id,
          title: input.title || generateTitleFromMessage(input.message),
          message: input.message,
          userCode: input.userCode,
          userDisplayName: input.userDisplayName,
          category: input.category,
          severity: input.severity,
          status: '未対応', // 新規作成時は常に未対応
          timeBand: input.timeBand,
          meetingSessionKey: input.meetingSessionKey,
          createdAt: now.toISOString(),
          createdByName: 'システム利用者', // TODO: 実際のユーザー情報を設定
          isDraft: false,
        };

        // 楽観的更新: まずUIに即座反映
        setState(prev => ({
          ...prev,
          todayHandoffs: [newRecord, ...prev.todayHandoffs],
        }));

        try {
          // localStorage に永続化（常に今日の日付で保存）
          const todayKey = getTodayKey(); // 新規作成は常に今日
          const store = loadStorage();
          const existing = store[todayKey] ?? [];
          store[todayKey] = [newRecord, ...existing];
          saveStorage(store);
        } catch (e) {
          // エラー時は楽観的更新を取り消し
          setState(prev => ({
            ...prev,
            todayHandoffs: prev.todayHandoffs.filter(item => item.id !== id),
            error: '申し送りの保存に失敗しました',
          }));

          console.error('[handoff] Save failed:', e);
          throw new Error('申し送りの保存に失敗しました');
        }
      }

      // 本番では meetingLogger などでログ出力
      console.log('[handoff] Created:', {
        id: newRecord.id,
        userDisplayName: newRecord.userDisplayName,
        category: newRecord.category,
        severity: newRecord.severity,
      });
    },
    [], // dateKey依存を削除（常にtoday keyを使用）
  );

  /**
   * 申し送りの状態を更新（Phase 8A: 2モード対応 + v3: carryOverDate対応）
   */
  const updateHandoffStatus = useCallback(
    async (id: number, newStatus: HandoffRecord['status'], carryOverDate?: string) => {
      // 楽観的更新
      const previousState = state.todayHandoffs;
      setState(prev => ({
        ...prev,
        todayHandoffs: prev.todayHandoffs.map(item =>
          item.id === id ? { ...item, status: newStatus, ...(carryOverDate ? { carryOverDate } : {}) } : item
        ),
      }));

      try {
        if (handoffConfig.storage === 'sharepoint') {
          // SharePoint API モード (v3: carryOverDate も渡す)
          await handoffApi.updateHandoffRecord(id.toString(), {
            status: newStatus,
            ...(carryOverDate ? { carryOverDate } : {}),
          });
        } else {
          // localStorage モード（開発用）
          const store = loadStorage();
          if (dayScope === 'week') {
            let storeUpdated = false;
            for (const key of Object.keys(store)) {
              const bucket = store[key];
              if (!Array.isArray(bucket)) continue;
              let bucketUpdated = false;
              const nextBucket = bucket.map(item => {
                if (item.id !== id) {
                  return item;
                }
                bucketUpdated = bucketUpdated || item.status !== newStatus;
                return { ...item, status: newStatus };
              });
              if (bucketUpdated) {
                store[key] = nextBucket;
                storeUpdated = true;
              }
            }
            if (storeUpdated) {
              saveStorage(store);
            }
          } else if (dateKey) {
            const existing = store[dateKey] ?? [];
            const updated = existing.map(item =>
              item.id === id ? { ...item, status: newStatus } : item
            );
            store[dateKey] = updated;
            saveStorage(store);
          }
        }

        console.log('[handoff] Status updated:', { id, newStatus });
      } catch (error) {
        // エラー時は楽観的更新を取り消し
        setState(prev => ({
          ...prev,
          todayHandoffs: previousState,
          error: handoffConfig.storage === 'sharepoint'
            ? 'SharePoint での状態更新に失敗しました'
            : '状態更新に失敗しました',
        }));
        console.error('[handoff] Status update failed:', error);
        throw new Error('状態更新に失敗しました');
      }
    },
    [dateKey, state.todayHandoffs],
  );

  // 初回ロード
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // 時間帯フィルタ適用
  const filteredHandoffs = useMemo(() => {
    if (timeFilter === 'all') return state.todayHandoffs;

    const allowedTimeBands = HANDOFF_TIME_FILTER_PRESETS[timeFilter];
    return state.todayHandoffs.filter(handoff =>
      allowedTimeBands.includes(handoff.timeBand)
    );
  }, [state.todayHandoffs, timeFilter]);

  return {
    // フィルタ適用済みデータ
    todayHandoffs: filteredHandoffs,
    // 全件データ（フィルタ無視）
    allHandoffs: state.todayHandoffs,
    loading: state.loading,
    error: state.error,

    // 操作（全件に対して実行）
    createHandoff,
    updateHandoffStatus,
    reload: loadToday,
  };
}
