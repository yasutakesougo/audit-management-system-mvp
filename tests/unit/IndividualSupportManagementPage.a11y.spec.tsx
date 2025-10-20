import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const recommendationMock = vi.fn(() => [
  {
    id: 'demo-rec',
    title: 'デモ提案',
    rationale: 'テスト用の提案です',
    actions: ['サンプルアクション'],
    stage: 'proactive' as const,
  },
]);

vi.mock('@/features/behavior-plan/BehaviorSupportPlanBuilder', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@/features/recommendations/useRecommendations', () => ({
  useRecommendations: () => recommendationMock(),
}));

let Page: React.ComponentType;

beforeAll(async () => {
  vi.stubEnv('VITE_FEATURE_SUPPORT_CDS', 'true');
  ({ default: Page } = await import('@/pages/IndividualSupportManagementPage'));
});

const renderRecordsTab = async () => {
  const utils = render(<Page />);
  const [recordsTab] = await screen.findAllByRole('tab', { name: '日々の記録' });
  fireEvent.click(recordsTab);
  return utils;
};

describe('IndividualSupportManagementPage accessibility affordances', () => {
  it('wires assessment foldout switch with aria-controls and expanded state', async () => {
    await renderRecordsTab();

    const foldoutToggle = (await screen.findByLabelText('開く')) as HTMLInputElement;
    expect(foldoutToggle).toHaveAttribute('aria-expanded', 'false');
    const controlsId = foldoutToggle.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const panel = controlsId ? document.getElementById(controlsId) : null;
    expect(panel).not.toBeNull();
  });

  it('exposes CDS proposals via polite live region and guards insert action when no slot is open', async () => {
    await renderRecordsTab();

    const liveRegion = await screen.findByRole('region', { name: '支援提案' });
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    const insertButton = await screen.findByRole('button', { name: 'この提案を特記事項に挿入' });
    expect(insertButton).toBeDisabled();
    expect(screen.getByText('挿入先の活動を開いてください')).toBeInTheDocument();
  });
});
