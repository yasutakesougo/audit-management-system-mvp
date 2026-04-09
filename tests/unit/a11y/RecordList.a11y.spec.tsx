import RecordList from '@/features/records/RecordList';
import { ToastProvider } from '@/hooks/useToast';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

expect.extend(toHaveNoViolations);

const listMock = vi.fn();
const addMock = vi.fn();

vi.mock('@/features/records/api', () => ({
  useRecordsApi: () => ({
    list: listMock,
    add: addMock,
  }),
}));

const renderRecordList = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <RecordList />
      </ToastProvider>
    </MemoryRouter>
  );

const defaultRecord = {
  Id: 1,
  Title: 'テスト記録',
  cr013_recorddate: '2026-03-22',
  cr013_specialnote: '特記事項',
};

/**
 * RecordList Accessibility Tests (#340)
 *
 * Verifies RecordList component has no axe violations
 * in empty state and with mock data
 */
describe('RecordList Accessibility', () => {
  beforeEach(() => {
    listMock.mockReset();
    addMock.mockReset();
    listMock.mockResolvedValue([]);
    addMock.mockResolvedValue(undefined);
  });

  test('has no a11y violations (empty state)', async () => {
    const { container } = renderRecordList();
    await screen.findByRole('heading', { name: '日々の記録' });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (with mock data)', async () => {
    listMock.mockResolvedValue([defaultRecord]);
    const { container } = renderRecordList();
    await screen.findByText('テスト記録');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (loading state)', async () => {
    listMock.mockImplementation(() => new Promise(() => undefined));
    const { container } = renderRecordList();
    await screen.findByRole('progressbar', { name: '読み込み中…' });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (error state)', async () => {
    listMock.mockRejectedValue(new Error('日次記録の取得に失敗しました'));
    const { container } = renderRecordList();
    await screen.findByRole('alert');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
