import type { Role } from '@/auth/roles';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HubLanding from '../HubLanding';

let mockRole: Role = 'viewer';

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({ role: mockRole, ready: true }),
}));

describe('HubLanding', () => {
  beforeEach(() => {
    mockRole = 'viewer';
  });

  it('hides admin-only entries for viewer', () => {
    render(
      <MemoryRouter initialEntries={['/planning']}>
        <HubLanding hubId="planning" />
      </MemoryRouter>,
    );

    expect(screen.getByText('個別支援計画')).toBeInTheDocument();
    expect(screen.queryByText('個別支援計画更新（前回比較）')).not.toBeInTheDocument();
    expect(screen.getByText('計画作成と見直し')).toBeInTheDocument();
    expect(screen.getByTestId('hub-landing-section-primary-planning')).toBeInTheDocument();
    expect(screen.getByTestId('hub-landing-section-secondary-planning')).toBeInTheDocument();
  });

  it('shows reception entries with primary/secondary/coming soon sections', () => {
    mockRole = 'reception';

    render(
      <MemoryRouter initialEntries={['/billing']}>
        <HubLanding hubId="billing" />
      </MemoryRouter>,
    );

    const primary = screen.getByTestId('hub-landing-section-primary-billing');
    const secondary = screen.getByTestId('hub-landing-section-secondary-billing');
    const comingSoon = screen.getByTestId('hub-landing-section-comingSoon-billing');

    expect(within(primary).getByText('請求処理')).toBeInTheDocument();
    expect(within(secondary).getByText('サービス提供実績記録')).toBeInTheDocument();
    expect(within(comingSoon).getByText('精算ダッシュボード')).toBeInTheDocument();
    expect(within(primary).getByText('請求画面を開く')).toBeInTheDocument();
    expect(screen.getByText('準備中')).toBeInTheDocument();
    expect(within(comingSoon).getAllByText('Coming Soon').length).toBeGreaterThan(0);
  });

  it('shows dictionary-driven empty state when no entry is visible for role', () => {
    render(
      <MemoryRouter initialEntries={['/billing']}>
        <HubLanding hubId="billing" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('hub-landing-empty-billing')).toBeInTheDocument();
    expect(screen.getByText('請求関連の導線がありません')).toBeInTheDocument();
    expect(screen.getByText('請求機能は受付または管理者ロールで利用できます。')).toBeInTheDocument();
    expect(screen.getByTestId('hub-empty-cta-billing')).toBeInTheDocument();
  });

  it('hides cards in kiosk query mode for today hub', () => {
    render(
      <MemoryRouter initialEntries={['/today?kiosk=1']}>
        <HubLanding hubId="today" hideCardsWhenKiosk>
          <div data-testid="today-content">today-content</div>
        </HubLanding>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument();
    expect(screen.getByTestId('today-content')).toBeInTheDocument();
  });
});
