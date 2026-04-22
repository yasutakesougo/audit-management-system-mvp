import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DriftObservabilityPanel } from '../DriftObservabilityPanel';
import { buildSinceIso } from '../useDriftObservability';

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<any>('@/lib/spClient');
  return {
    ...actual,
    useSP: () => ({}),
    ensureConfig: () => ({ baseUrl: 'https://dummy.sharepoint.com' }),
  };
});

describe('DriftObservabilityPanel', () => {
  it('renders empty-state labels and unresolved=0 when no events exist', async () => {
    const repository = {
      logEvent: vi.fn(async () => {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getEvents: vi.fn(async () => []) as any,
      markResolved: vi.fn(async () => {}),
    };

    render(
      <DriftObservabilityPanel
        repository={repository}
        nowProvider={() => new Date('2026-04-04T09:30:00.000Z')}
      />,
    );

    await waitFor(() => {
      expect(repository.getEvents).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByText('No drift events')).toHaveLength(2);
    expect(screen.getByTestId('drift-unresolved-count')).toHaveTextContent('0');
  });

  it('switches weekly -> daily and refreshes metrics', async () => {
    const now = new Date('2026-04-04T09:30:00.000Z');
    const weeklySince = buildSinceIso('weekly', now);
    const dailySince = buildSinceIso('daily', now);

    const repository = {
      logEvent: vi.fn(async () => {}),
      getEvents: vi.fn(async (filter?: { since?: string }) => {
        if (filter?.since === dailySince) {
          return [
            { id: '1', listName: 'Daily_Attendance', fieldName: 'UserID', resolved: false, driftType: 'missing', severity: 'warn', detectedAt: '2026-04-04', resolutionType: 'fallback' },
          ];
        }
        return [
          { id: '2', listName: 'Daily_Attendance', fieldName: 'Status0', resolved: false, driftType: 'missing', severity: 'warn', detectedAt: '2026-04-04', resolutionType: 'fallback' },
          { id: '3', listName: 'Daily_Attendance', fieldName: 'Status0', resolved: false, driftType: 'missing', severity: 'warn', detectedAt: '2026-04-04', resolutionType: 'fallback' },
          { id: '4', listName: 'Users_Master', fieldName: 'UserID', resolved: true, driftType: 'missing', severity: 'warn', detectedAt: '2026-04-04', resolutionType: 'fallback' },
        ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      markResolved: vi.fn(async () => {}),
    };

    render(<DriftObservabilityPanel repository={repository} nowProvider={() => now} />);

    await waitFor(() => {
      expect(repository.getEvents).toHaveBeenCalledWith({ since: weeklySince });
    });
    expect(screen.getByText(/Status0/)).toBeInTheDocument();
    expect(screen.getByTestId('drift-unresolved-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: '日次' }));

    await waitFor(() => {
      expect(repository.getEvents).toHaveBeenCalledWith({ since: dailySince });
    });
    expect(screen.getByText(/UserID/)).toBeInTheDocument();
    expect(screen.getByTestId('drift-unresolved-count')).toHaveTextContent('1');
  });
});
