import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TableDailyRecordRoute from '../TableDailyRecordRoute';

const state = vi.hoisted(() => ({
  dailyRepository: { kind: 'daily' },
  reviewRepository: { kind: 'review' },
  composedRepository: { kind: 'composed' },
  createRepository: vi.fn(),
}));

vi.mock('@/features/daily', () => ({
  useDailyRecordRepository: () => state.dailyRepository,
  TableDailyRecordPage: ({ repository }: { repository: unknown }) => (
    <div data-testid="daily-repository">{repository === state.composedRepository ? 'composed' : 'unexpected'}</div>
  ),
}));

vi.mock('@/features/record-quality', () => ({
  useRecordQualityRuntime: () => ({
    reviewRepository: state.reviewRepository,
    queueRepository: {},
  }),
}));

vi.mock('../../services/createDailyRecordQualityReviewRepository', () => ({
  createDailyRecordQualityReviewRepository: (options: unknown) => {
    state.createRepository(options);
    return state.composedRepository;
  },
}));

describe('TableDailyRecordRoute', () => {
  it('composes the public daily and record-quality ports in the app route', () => {
    render(<TableDailyRecordRoute />);

    expect(screen.getByTestId('daily-repository')).toHaveTextContent('composed');
    expect(state.createRepository).toHaveBeenCalledWith({
      dailyRepository: state.dailyRepository,
      reviewRepository: state.reviewRepository,
    });
  });
});
