import { renderHook } from '@testing-library/react';
import { useActionEnforcement } from '../hooks/useActionEnforcement';
import { useExceptionCenterOrchestrator } from '../hooks/useExceptionCenterOrchestrator';
import { useLocation } from 'react-router-dom';
import { useWorkTaskStore } from '../store/workTaskStore';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// モック化
vi.mock('../hooks/useExceptionCenterOrchestrator');
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useLocation: vi.fn(),
  };
});

describe('Action Enforcement Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトの設定
    (useLocation as any).mockReturnValue({ pathname: '/users' });
    (useExceptionCenterOrchestrator as any).mockReturnValue({
      items: [],
      isLoading: false,
    });
    // Storeをリセット（必要に応じて）
    useWorkTaskStore.setState({ acknowledgedIds: {} });
  });

  it('1: 必須業務がある場合、白リスト外のページではブロックされること', () => {
    (useExceptionCenterOrchestrator as any).mockReturnValue({
      items: [{ id: '1', severity: 'critical', title: '重大不備', stableId: 'TASK-1' }],
      isLoading: false,
    });
    (useLocation as any).mockReturnValue({ pathname: '/users' });

    const { result } = renderHook(() => useActionEnforcement());
    expect(result.current.isBlocked).toBe(true);
    expect(result.current.totalCriticalCount).toBe(1);
  });

  it('2: Today 画面はブロック対象外であること（白リスト）', () => {
    (useExceptionCenterOrchestrator as any).mockReturnValue({
      items: [{ id: '1', severity: 'critical', title: '重大不備', stableId: 'TASK-1' }],
      isLoading: false,
    });
    (useLocation as any).mockReturnValue({ pathname: '/today' });

    const { result } = renderHook(() => useActionEnforcement());
    expect(result.current.isBlocked).toBe(false);
  });

  it('3: 承諾済み（Acknowledged）のタスクはブロック対象から除外されること', () => {
    const taskId = 'TASK-1';
    (useExceptionCenterOrchestrator as any).mockReturnValue({
      items: [{ id: '1', severity: 'critical', title: '重大不備', stableId: taskId }],
      isLoading: false,
    });
    (useLocation as any).mockReturnValue({ pathname: '/users' });
    
    // 手動で承諾状態にする
    useWorkTaskStore.setState({ 
      acknowledgedIds: { 
        [taskId]: { timestamp: new Date().toISOString(), reason: 'CONFIRMED' } 
      } 
    });

    const { result } = renderHook(() => useActionEnforcement());
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.criticalTasks).toHaveLength(0);
    expect(result.current.totalCriticalCount).toBe(1); // 存在はしているが unacknowledged ではない
  });

  it('4: Warning レベルのタスクではブロックされないこと（精度確認）', () => {
    (useExceptionCenterOrchestrator as any).mockReturnValue({
      items: [{ id: '1', severity: 'medium', title: '警告', stableId: 'TASK-W' }],
      isLoading: false,
    });
    (useLocation as any).mockReturnValue({ pathname: '/users' });

    const { result } = renderHook(() => useActionEnforcement());
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.criticalTasks).toHaveLength(0);
  });

  it('5: warn モードの場合はブロックが常に解除されていること（段階導入機能）', () => {
     // NOTE: 現在の useActionEnforcement 内で mode = 'soft-lock' がハードコードされている場合は
     // このテストを通すために hook 側の mode を外部注入可能にするか、テスト時のみ書き換える必要がある。
     // ここでは将来的な mode 制御の重要性を示す契約として定義。
  });
});
