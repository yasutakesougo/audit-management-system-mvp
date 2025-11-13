import HealthObservationWorkspace from '@/features/nurse/observation/HealthObservationWorkspace';
import { TESTIDS } from '@/testids';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ObsParams = {
  user: string;
  date: string;
  set: (next: { user?: string; date?: string }) => void;
};

const setMock = vi.hoisted(() => vi.fn<(next: { user?: string; date?: string }) => void>());
const seizureComponentMock = vi.hoisted(() => vi.fn(() => <div data-testid="mock-seizure" />));

vi.mock('@/features/nurse/observation/useObsWorkspaceParams', () => ({
  useObsWorkspaceParams: (): ObsParams => ({
    user: 'I001',
    date: '2025-11-04',
    set: setMock,
  }),
}));

vi.mock('@/features/nurse/observation/SeizureQuickLog', () => ({
  __esModule: true,
  default: seizureComponentMock,
}));

describe('HealthObservationWorkspace (seizure only)', () => {
  beforeEach(() => {
    setMock.mockClear();
    seizureComponentMock.mockClear();
  });

  it('renders heading and passes context to quick log', () => {
    render(<HealthObservationWorkspace />);

    expect(screen.getByRole('heading', { level: 1, name: '発作記録' })).toBeVisible();
    expect(screen.getByTestId('mock-seizure')).toBeVisible();
    expect(seizureComponentMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'I001', date: '2025-11-04' }),
      {},
    );
  });

  it('delegates user selection to query param setter', async () => {
    render(<HealthObservationWorkspace />);

    const [select] = screen.getAllByLabelText('利用者');
    fireEvent.mouseDown(select);
    const option = await screen.findByRole('option', { name: /I052/ });
    fireEvent.click(option);

    expect(setMock).toHaveBeenCalledWith({ user: 'I052' });
  });

  it('delegates date selection to query param setter', () => {
    render(<HealthObservationWorkspace />);

  const [dateInput] = screen.getAllByTestId(TESTIDS.NURSE_SEIZURE_DATE);
    fireEvent.change(dateInput, { target: { value: '2025-12-01' } });

    expect(setMock).toHaveBeenCalledWith({ date: '2025-12-01' });
  });
});
