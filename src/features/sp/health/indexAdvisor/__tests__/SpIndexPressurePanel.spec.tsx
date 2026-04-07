import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpIndexPressurePanel } from '../SpIndexPressurePanel';
import * as hooks from '../useSpIndexCandidates';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../useSpIndexCandidates', () => ({
  useSpIndexCandidates: vi.fn(),
}));

describe('SpIndexPressurePanel: UI Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when there are no candidates (Healthy state)', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [],
      hasKnownConfig: true,
      loading: false,
      error: null,
    });

    const { container } = render(<SpIndexPressurePanel listName="HealthyList" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when loading (Silent wait)', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [],
      hasKnownConfig: true,
      loading: true,
      error: null,
    });

    const { container } = render(<SpIndexPressurePanel listName="LoadingList" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render Urgent section when additionCandidates exist', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [
        { internalName: 'UrgentField', displayName: '至急列', reason: '5000件エラー回避' },
      ],
      hasKnownConfig: true,
      loading: false,
      error: null,
    });

    render(<SpIndexPressurePanel listName="AlertList" />);

    // Check for Urgent header and Action text
    expect(screen.getByText(/至急対応が必要/)).toBeTruthy();
    expect(screen.getByText(/至急列/)).toBeTruthy();
    expect(screen.getByText(/5000件エラー回避/)).toBeTruthy();
    expect(screen.getByText(/SharePoint のリスト設定/)).toBeTruthy();
  });

  it('should render Optional section when only deletionCandidates exist', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [
        { internalName: 'ObsoleteField', displayName: '不要列', typeAsString: 'Note', deletionReason: 'Note型' },
      ],
      additionCandidates: [],
      hasKnownConfig: true,
      loading: false,
      error: null,
    });

    render(<SpIndexPressurePanel listName="OptimizableList" />);

    // Check for Optimization header (Optional cleanup)
    expect(screen.getByText(/最適化の提案/)).toBeTruthy();
    expect(screen.getByText(/不要列/)).toBeTruthy();
    expect(screen.getAllByText(/Note型/).length).toBeGreaterThan(0);
    
    // Urgent section should NOT be visible
    expect(screen.queryByText(/至急対応が必要/)).toBeNull();
  });

  it('should render both sections when both candidates exist, with Urgent first', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [
        { internalName: 'DelField', displayName: '消す列', typeAsString: 'Text', deletionReason: 'unused' },
      ],
      additionCandidates: [
        { internalName: 'AddField', displayName: '足す列', reason: 'mandatory' },
      ],
      hasKnownConfig: true,
      loading: false,
      error: null,
    });

    const { container } = render(<SpIndexPressurePanel listName="MixedList" />);

    // Urgent section (red) should appear before Optimization section (blue/yellow)
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(2);
    expect(sections[0].className).toContain('bg-red-50');
    expect(sections[1].className).toContain('bg-blue-50');
  });

  it('should handle error state gracefully', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [],
      hasKnownConfig: true,
      loading: false,
      error: 'API Timeout',
    });

    render(<SpIndexPressurePanel listName="ErrorList" />);
    expect(screen.getByText(/インデックス解析に失敗しました/)).toBeTruthy();
    expect(screen.getByText(/API Timeout/)).toBeTruthy();
  });
});
