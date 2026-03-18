import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTodayQueueTelemetryStore } from '../todayQueueTelemetryStore';
import { TodayQueueHudPanel } from '../TodayQueueHudPanel';

describe('TodayQueueHudPanel', () => {
  beforeEach(() => {
    // Reset global zustand state
    useTodayQueueTelemetryStore.setState({ samples: [] });
  });

  const baseSample = {
    timestamp: 1000,
    queueSize: 10,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
    overdueCount: 0,
    requiresAttentionCount: 0,
  };

  it('sample がないとき "No queue telemetry yet" が表示される', () => {
    render(<TodayQueueHudPanel />);
    expect(screen.getByText('No queue telemetry yet')).not.toBeNull();
    expect(screen.queryByTestId('hud-today-queue-data')).toBeNull();
  });

  it('sample があるとき items / P0 / overdue などが表示される', () => {
    useTodayQueueTelemetryStore.setState({
      samples: [
        {
          ...baseSample,
          queueSize: 5,
        },
      ],
    });

    render(<TodayQueueHudPanel />);
    
    // データコンテナが表示されていること
    const panel = screen.getByTestId('hud-today-queue-data');
    expect(panel).not.toBeNull();
    
    // items / P0 / overdue などのラベルが表示されていること
    expect(screen.getByText(/total/i)).not.toBeNull();
    expect(screen.getByText('P0')).not.toBeNull();
    expect(screen.getByText(/overdue/i)).not.toBeNull();
  });

  it('P0 があるとき warning 的な強調が出る', () => {
    useTodayQueueTelemetryStore.setState({
      samples: [{ ...baseSample, p0Count: 1 }],
    });

    render(<TodayQueueHudPanel />);
    const panel = screen.getByTestId('hud-today-queue-data');
    
    // Warning色になっていること (#f87171) と shadow がついていること
    expect(panel.style.borderLeft).toContain('rgb(248, 113, 113)'); // browser converts hex to rgb
    expect(panel.style.boxShadow).not.toBe('none');
  });

  it('overdue があるとき overdue 強調(caution)が出る', () => {
    useTodayQueueTelemetryStore.setState({
      samples: [{ ...baseSample, overdueCount: 1 }],
    });

    render(<TodayQueueHudPanel />);
    const panel = screen.getByTestId('hud-today-queue-data');
    
    // Caution色になっていること (#fbbf24) と shadow はついていないこと
    expect(panel.style.borderLeft).toContain('rgb(251, 191, 36)');
    expect(panel.style.boxShadow).toBe('none');
  });

  it('queueSize === 0 のとき muted / calm になる', () => {
    useTodayQueueTelemetryStore.setState({
      samples: [{ ...baseSample, queueSize: 0 }],
    });

    render(<TodayQueueHudPanel />);
    const panel = screen.getByTestId('hud-today-queue-data');
    
    // Muted色になっていること
    expect(panel.style.borderLeft).toContain('rgba(148, 163, 184, 0.4)');
  });
});
