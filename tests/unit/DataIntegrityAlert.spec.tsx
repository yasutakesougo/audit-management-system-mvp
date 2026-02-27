import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Mock env module
vi.mock('@/lib/env', () => ({
  env: { VITE_AUDIT_DEBUG: false },
}));

import DataIntegrityAlert from '@/components/DataIntegrityAlert';

const createZodError = () => {
  const schema = z.object({
    Title: z.string(),
    Email: z.string().min(1),
  });
  const result = schema.safeParse({ Title: 123, Email: '' });
  if (result.success) throw new Error('Expected failure');
  return result.error;
};

describe('DataIntegrityAlert', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders warning banner with issue count', () => {
    const error = createZodError();
    render(<DataIntegrityAlert error={error} />);

    expect(screen.getByTestId('data-integrity-alert')).toBeDefined();
    expect(screen.getByText(/不整合/)).toBeDefined();
  });

  it('hides detail toggle in normal mode (VITE_AUDIT_DEBUG=false)', () => {
    const error = createZodError();
    render(<DataIntegrityAlert error={error} />);

    expect(screen.queryByTestId('data-integrity-toggle')).toBeNull();
    expect(screen.getByText(/管理者にお問い合わせください/)).toBeDefined();
  });

  it('shows detail toggle in admin mode (VITE_AUDIT_DEBUG=true)', async () => {
    // Override the mock for this test
    const envModule = await import('@/lib/env');
    (envModule as { env: Record<string, unknown> }).env.VITE_AUDIT_DEBUG = true;

    const error = createZodError();
    render(<DataIntegrityAlert error={error} />);

    expect(screen.getByTestId('data-integrity-toggle')).toBeDefined();
    expect(screen.getByTestId('data-integrity-copy')).toBeDefined();

    // Restore
    (envModule as { env: Record<string, unknown> }).env.VITE_AUDIT_DEBUG = false;
  });

  it('expands issue list when toggle clicked in admin mode', async () => {
    const envModule = await import('@/lib/env');
    (envModule as { env: Record<string, unknown> }).env.VITE_AUDIT_DEBUG = true;

    const error = createZodError();
    render(<DataIntegrityAlert error={error} />);

    const toggle = screen.getByTestId('data-integrity-toggle');
    fireEvent.click(toggle);

    // After expansion, individual issues should be visible
    expect(screen.getByTestId('data-integrity-issue-0')).toBeDefined();

    // Restore
    (envModule as { env: Record<string, unknown> }).env.VITE_AUDIT_DEBUG = false;
  });

  it('shows context label when provided', () => {
    const error = createZodError();
    render(<DataIntegrityAlert error={error} context="users" />);

    expect(screen.getByText('(users)')).toBeDefined();
  });

  it('calls onDismiss when close button clicked', () => {
    const error = createZodError();
    const onDismiss = vi.fn();
    render(<DataIntegrityAlert error={error} onDismiss={onDismiss} />);

    const closeBtn = screen.getByTestId('data-integrity-dismiss');
    fireEvent.click(closeBtn);

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
