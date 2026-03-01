import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// テスト対象をインポートする前に localStorage モックを準備
// vitest は jsdom 環境で localStorage を自動提供
// ---------------------------------------------------------------------------

import {
    __clearStore,
    __flushPersist,
    __resetStore,
    useProcedureStore,
} from '../procedureStore';

// renderHook helper (react-testing-library pattern)
import { act, renderHook } from '@testing-library/react';

const STORAGE_KEY = 'procedureStore.v1';

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  __clearStore();
});

afterEach(() => {
  localStorage.clear();
  __clearStore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('procedureStore', () => {
  it('未登録ユーザーには BASE_STEPS をフォールバックで返す', () => {
    const { result } = renderHook(() => useProcedureStore());
    const items = result.current.getByUser('unknown-user');

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toBe('base-0900');
  });

  it('save → getByUser ラウンドトリップ', () => {
    const { result } = renderHook(() => useProcedureStore());
    const testItems = [
      { id: 'test-1', time: '09:00', activity: 'テスト活動', instruction: 'テスト', isKey: false, linkedInterventionIds: [] },
    ];

    act(() => {
      result.current.save('I001', testItems);
    });

    const retrieved = result.current.getByUser('I001');
    expect(retrieved).toEqual(testItems);
  });

  it('hasUserData: 未登録ユーザー → false', () => {
    const { result } = renderHook(() => useProcedureStore());
    expect(result.current.hasUserData('I001')).toBe(false);
  });

  it('hasUserData: 登録済みユーザー → true', () => {
    const { result } = renderHook(() => useProcedureStore());

    act(() => {
      result.current.save('I001', [
        { id: 'test-1', time: '09:00', activity: 'テスト', instruction: '', isKey: false, linkedInterventionIds: [] },
      ]);
    });

    expect(result.current.hasUserData('I001')).toBe(true);
  });

  it('localStorage に永続化される（__flushPersist 後）', () => {
    const { result } = renderHook(() => useProcedureStore());
    const testItems = [
      { id: 'csv-1', time: '10:00', activity: 'CSV活動', instruction: 'CSV', isKey: false, linkedInterventionIds: [] },
    ];

    act(() => {
      result.current.save('I001', testItems);
    });

    // debounce をフラッシュ
    __flushPersist();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.data['I001']).toEqual(testItems);
  });

  it('__resetStore でリロードをシミュレート', () => {
    const { result } = renderHook(() => useProcedureStore());
    const testItems = [
      { id: 'persist-1', time: '09:00', activity: '永続化テスト', instruction: '', isKey: false, linkedInterventionIds: [] },
    ];

    // 保存して永続化
    act(() => {
      result.current.save('I002', testItems);
    });
    __flushPersist();

    // store をリセット（リロード相当）
    act(() => {
      __resetStore();
    });

    // localStorage から復元されているはず
    const retrieved = result.current.getByUser('I002');
    expect(retrieved).toEqual(testItems);
  });

  it('registeredUserIds: 登録済みユーザーIDリスト', () => {
    const { result } = renderHook(() => useProcedureStore());

    act(() => {
      result.current.save('I001', [{ id: '1', time: '09:00', activity: 'A', instruction: '', isKey: false, linkedInterventionIds: [] }]);
      result.current.save('I002', [{ id: '2', time: '10:00', activity: 'B', instruction: '', isKey: false, linkedInterventionIds: [] }]);
    });

    const ids = result.current.registeredUserIds();
    expect(ids).toContain('I001');
    expect(ids).toContain('I002');
  });

  it('空の userId では save が無視される', () => {
    const { result } = renderHook(() => useProcedureStore());

    act(() => {
      result.current.save('', [{ id: '1', time: '09:00', activity: 'X', instruction: '', isKey: false, linkedInterventionIds: [] }]);
    });

    expect(result.current.registeredUserIds()).toEqual([]);
  });

  it('壊れた localStorage データはクリアされてフォールバック', () => {
    // 壊れたデータを仕込む
    localStorage.setItem(STORAGE_KEY, 'not-valid-json!!!');

    act(() => {
      __resetStore();
    });

    const { result } = renderHook(() => useProcedureStore());
    // フォールバックの BASE_STEPS が返る
    const items = result.current.getByUser('anyone');
    expect(items[0].id).toBe('base-0900');
    // 壊れたデータは削除されている
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
