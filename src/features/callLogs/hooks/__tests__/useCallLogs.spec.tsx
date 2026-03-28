/**
 * useCallLogs — hook 動作テスト
 *
 * 対象:
 *   - "all" タブ → status フィルタなしで repository を呼ぶこと
 *   - 特定 status タブ → 対応する status でフィルタすること
 *   - createLog / updateStatus が mutation 後に invalidate すること
 *
 * 方針:
 * - Repository を InMemory 実装で差し替え (shouldSkipSharePoint = true)
 * - React Query は QueryClientProvider でラップして実際に動かす
 * - useAuth はモックして acquireToken / account を返す
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';

// ── モック ──────────────────────────────────────────────────────────────────

// shouldSkipSharePoint → true にして InMemory を使わせる
vi.mock('@/lib/env', () => ({
  shouldSkipSharePoint: vi.fn(() => true),
}));

// useAuth モック
vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({
    acquireToken: async () => null,
    account: { name: 'テスト受付者' },
  })),
}));

// ── テスト用 import ──────────────────────────────────────────────────────────

import { useCallLogs } from '../useCallLogs';
import { __resetCallLogRepositoryFactoryForTests } from '../../data/callLogRepositoryFactory';
import { __resetInMemoryCallLogStoreForTests } from '../../data/InMemoryCallLogRepository';

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function makeWrapper(qc: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

// ── テスト ───────────────────────────────────────────────────────────────────

describe('useCallLogs', () => {
  let qc: QueryClient;

  beforeEach(() => {
    __resetCallLogRepositoryFactoryForTests();
    __resetInMemoryCallLogStoreForTests();
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('should return an empty array on initial load (InMemory has no seed data)', async () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCallLogs({ activeTab: 'all' }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.logs).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should expose createLog and updateStatus as mutation functions', () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCallLogs(), { wrapper });

    expect(typeof result.current.createLog.mutate).toBe('function');
    expect(typeof result.current.updateStatus.mutate).toBe('function');
  });

  it('should expose refresh as a function', () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCallLogs(), { wrapper });

    expect(typeof result.current.refresh).toBe('function');
  });

  it('should create a log and return it in the list', async () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCallLogs({ activeTab: 'all' }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.createLog.mutate({
      callerName: '田中太郎',
      targetStaffName: '山田スタッフ',
      subject: 'テスト件名',
      message: 'テスト本文',
      needCallback: false,
    });

    await waitFor(() => expect(result.current.logs?.length).toBe(1));
    expect(result.current.logs?.[0].callerName).toBe('田中太郎');
    expect(result.current.logs?.[0].status).toBe('new');
  });

  it('should create callback_pending when needCallback=true', async () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCallLogs({ activeTab: 'all' }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.createLog.mutate({
      callerName: '佐藤花子',
      targetStaffName: '山田スタッフ',
      subject: '折返し依頼',
      message: '折返しお願いします',
      needCallback: true,
      callbackDueAt: '2026-03-28T12:00:00.000Z',
    });

    await waitFor(() => expect(result.current.logs?.length).toBe(1));
    expect(result.current.logs?.[0].status).toBe('callback_pending');
  });

  it('should keep callback lifecycle: callback_pending -> done -> callback_pending', async () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCallLogs({ activeTab: 'all' }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const created = await result.current.createLog.mutateAsync({
      callerName: '運用シナリオ',
      targetStaffName: '山田スタッフ',
      subject: '折返し運用テスト',
      message: '折返しをお願いします',
      needCallback: true,
      callbackDueAt: '2026-03-28T12:30:00.000Z',
    });

    await waitFor(() => expect(result.current.logs?.length).toBe(1));
    expect(result.current.logs?.[0].status).toBe('callback_pending');
    expect(result.current.logs?.[0].completedAt).toBeUndefined();

    await result.current.updateStatus.mutateAsync({ id: created.id, status: 'done' });

    await waitFor(() => expect(result.current.logs?.[0].status).toBe('done'));
    expect(result.current.logs?.[0].completedAt).toBeDefined();
    const doneCompletedAt = result.current.logs?.[0].completedAt;
    expect(doneCompletedAt).toBeTruthy();

    await result.current.updateStatus.mutateAsync({
      id: created.id,
      status: 'callback_pending',
    });

    await waitFor(() => expect(result.current.logs?.[0].status).toBe('callback_pending'));
    expect(result.current.logs?.[0].completedAt).toBeUndefined();
    expect(result.current.logs?.[0].callbackDueAt).toBe('2026-03-28T12:30:00.000Z');
  });

  /**
   * updateStatus の統合テストは InMemoryCallLogRepository.spec.ts で実施する。
   * hook は mutation function が公開されており呼び出し可能なことを確認する。
   */
  it('should have updateStatus mutation that can be called', () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCallLogs({ activeTab: 'all' }), { wrapper });

    // mutation は呼び出し可能な関数として公開されていること
    expect(typeof result.current.updateStatus.mutate).toBe('function');
    expect(typeof result.current.updateStatus.mutateAsync).toBe('function');
  });
});
