import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from '@/hooks/useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('throws when used outside of provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useToast())).toThrowError('useToast must be used within a <ToastProvider>');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('creates toast entries using crypto.randomUUID when available and removes after timeout', () => {
    const cryptoGetter = vi.spyOn(globalThis, 'crypto', 'get');
    const randomUUID = vi.fn(() => 'uuid-1234');
    cryptoGetter.mockReturnValue({ randomUUID } as unknown as Crypto);

    const Trigger: React.FC = () => {
      const { show } = useToast();
      return <button onClick={() => show('success', '保存しました')} type="button">Trigger success</button>;
    };

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trigger success' }));

    expect(randomUUID).toHaveBeenCalled();

    const toasts = screen.getAllByTestId('toast-message');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toBe('保存しました');
    expect(toasts[0].className).toContain('bg-green-600');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryAllByTestId('toast-message')).toHaveLength(0);

    cryptoGetter.mockRestore();
  });

  it('falls back to timestamp ids when crypto unavailable and renders info styling', () => {
    const cryptoGetter = vi.spyOn(globalThis, 'crypto', 'get');
    cryptoGetter.mockReturnValue(undefined as unknown as Crypto);
    const mathRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const Trigger: React.FC = () => {
      const { show } = useToast();
      return <button onClick={() => show('info', '読み込み中')} type="button">Trigger info</button>;
    };

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trigger info' }));

    const toasts = screen.getAllByTestId('toast-message');
    expect(toasts[0].className).toContain('bg-slate-800');
    expect(toasts[0].textContent).toBe('読み込み中');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryAllByTestId('toast-message')).toHaveLength(0);

    mathRandom.mockRestore();
    cryptoGetter.mockRestore();
  });

  it('renders warning styling branch', () => {
    const cryptoGetter = vi.spyOn(globalThis, 'crypto', 'get');
    cryptoGetter.mockReturnValue(undefined as unknown as Crypto);

    const Trigger: React.FC = () => {
      const { show } = useToast();
      return <button onClick={() => show('warning', '接続が不安定です')} type="button">Trigger warning</button>;
    };

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trigger warning' }));

    const toasts = screen.getAllByTestId('toast-message');
    expect(toasts[0].className).toContain('bg-amber-600');

    cryptoGetter.mockRestore();
  });
});
