import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LayoutProvider,
  useDensity,
  useDisplayMode,
  useOrientation,
  useViewport,
} from '@/app/LayoutContext';

type VisualViewportMock = {
  width: number;
  height: number;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

const visualViewportMock: VisualViewportMock = {
  width: 1024,
  height: 768,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const originalViewport = {
  innerWidth: globalThis.innerWidth,
  innerHeight: globalThis.innerHeight,
};
const originalVisualViewport = window.visualViewport;
const originalRaf = globalThis.requestAnimationFrame;
const originalCancelRaf = globalThis.cancelAnimationFrame;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  visualViewportMock.width = width;
  visualViewportMock.height = height;
}

describe('LayoutProvider', () => {
  beforeEach(() => {
    visualViewportMock.addEventListener = vi.fn();
    visualViewportMock.removeEventListener = vi.fn();
    (globalThis as Record<string, unknown>).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
    (globalThis as Record<string, unknown>).cancelAnimationFrame = () => undefined;

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewportMock,
    });

    setViewport(1024, 768);
  });

  afterEach(() => {
    cleanup();
    if (originalRaf) {
      (globalThis as Record<string, unknown>).requestAnimationFrame = originalRaf;
    } else {
      delete (globalThis as Record<string, unknown>).requestAnimationFrame;
    }
    if (originalCancelRaf) {
      (globalThis as Record<string, unknown>).cancelAnimationFrame = originalCancelRaf;
    } else {
      delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
    }
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: originalVisualViewport,
    });
    setViewport(originalViewport.innerWidth, originalViewport.innerHeight);
  });

  it('transitions display mode across breakpoints', async () => {
    const ModeProbe = () => {
      const mode = useDisplayMode();
      return <span data-testid="mode">{mode}</span>;
    };

    setViewport(500, 900);
    render(
      <LayoutProvider breakpoints={{ sceneA: 600, sceneB: 900 }}>
        <ModeProbe />
      </LayoutProvider>,
    );

    expect(screen.getByTestId('mode').textContent).toBe('sceneA');

    await act(async () => {
      setViewport(750, 900);
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('mode').textContent).toBe('hybrid');

    await act(async () => {
      setViewport(1200, 900);
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('mode').textContent).toBe('sceneB');
  });

  it('honors forceDensity override across updates', async () => {
    const DensityProbe = () => {
      const density = useDensity();
      return <span data-testid="density">{density}</span>;
    };

    setViewport(480, 900);
    render(
      <LayoutProvider forceDensity="compact">
        <DensityProbe />
      </LayoutProvider>,
    );

    expect(screen.getByTestId('density').textContent).toBe('compact');

    await act(async () => {
      setViewport(1400, 900);
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('density').textContent).toBe('compact');
  });

  it('exposes viewport and orientation helpers', async () => {
    const ViewportProbe = () => {
      const { width, height } = useViewport();
      const { isPortrait, isLandscape } = useOrientation();
      return (
        <>
          <span data-testid="width">{width}</span>
          <span data-testid="height">{height}</span>
          <span data-testid="portrait">{String(isPortrait)}</span>
          <span data-testid="landscape">{String(isLandscape)}</span>
        </>
      );
    };

    setViewport(600, 900);
    render(
      <LayoutProvider>
        <ViewportProbe />
      </LayoutProvider>,
    );

    expect(screen.getByTestId('width').textContent).toBe('600');
    expect(screen.getByTestId('height').textContent).toBe('900');
    expect(screen.getByTestId('portrait').textContent).toBe('true');
    expect(screen.getByTestId('landscape').textContent).toBe('false');

    await act(async () => {
      setViewport(1200, 600);
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('width').textContent).toBe('1200');
    expect(screen.getByTestId('height').textContent).toBe('600');
    expect(screen.getByTestId('portrait').textContent).toBe('false');
    expect(screen.getByTestId('landscape').textContent).toBe('true');
  });
});
