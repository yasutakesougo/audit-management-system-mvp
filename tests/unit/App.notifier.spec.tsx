import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '@/hooks/useToast';
import { ToastNotifierBridge } from '@/App';
import * as noticeModule from '@/lib/notice';

let lastHandler: ((msg: string) => void) | null = null;
let registerSpy: ReturnType<typeof vi.spyOn> | null = null;

describe('App notifier → toast bridge', () => {
  beforeEach(() => {
    registerSpy = vi.spyOn(noticeModule, 'registerNotifier').mockImplementation((fn: ((msg: string) => void) | null) => {
      lastHandler = fn;
    });
  });

  afterEach(() => {
    registerSpy?.mockRestore();
    registerSpy = null;
    lastHandler = null;
  });

  it('registers notifier and shows a toast when invoked', async () => {
    render(
      <ToastProvider>
        <ToastNotifierBridge />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(lastHandler).toBeTypeOf('function');
    });

    const MESSAGE = 'こんにちは、これは通知テストです';

    await act(async () => {
      lastHandler?.(MESSAGE);
    });

    await waitFor(() => {
      expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    });
  });
});
