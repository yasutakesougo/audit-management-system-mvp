import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { Decorator, Preview } from '@storybook/react';
import { initialize, mswDecorator } from 'msw-storybook-addon';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../src/features/nurse/components/ToastContext';
import { nurseCssVars, nurseTheme } from '../src/features/nurse/theme/tokens';
import { makeNurseHandlers } from '../src/mocks/handlers/nurse';

initialize();

export const globalTypes = {
  network: {
    name: 'Network',
    description: 'Mock network conditions',
    defaultValue: 'fast',
    toolbar: {
      icon: 'globe',
      items: [
        { value: 'fast', title: 'Fast (200–300ms)' },
        { value: 'slow', title: 'Slow (800ms)' },
        { value: 'error', title: 'Error (503)' },
        { value: 'partial', title: 'Partial (1/2)' },
      ],
    },
  },
  nurseMode: {
    name: 'Nurse Flush Mode',
    description: 'MSW handler mode for nurse flush API',
    defaultValue: 'ok',
    toolbar: {
      icon: 'sync',
      items: [
        { value: 'ok', title: 'OK' },
        { value: 'partial', title: 'Partial' },
        { value: 'error', title: 'Error' },
      ],
      dynamicTitle: true,
    },
  },
  bulkEntry: {
    name: 'Bulk Entry',
    description: 'Enable Bulk Entry tab',
    defaultValue: true,
    toolbar: {
      icon: 'list',
      items: [
        { value: true, title: 'Enabled' },
        { value: false, title: 'Disabled' },
      ],
      dynamicTitle: true,
    },
  },
  minuteBasis: {
    name: 'Minute Basis',
    description: 'Toggle UTC/Local minute window basis',
    defaultValue: 'utc',
    toolbar: {
      icon: 'clock',
      items: [
        { value: 'utc', title: 'UTC' },
        { value: 'local', title: 'Local' },
      ],
      dynamicTitle: true,
    },
  },
} as const;

const CORE_FLAG_KEYS = ['VITE_FEATURE_NURSE_UI', 'feature:nurseUI'] as const;
const BULK_FLAG_KEYS = ['VITE_NURSE_BULK_ENTRY', 'feature:nurseBulkEntry'] as const;

const withNurseProviders: Decorator = (Story, context) => {
  const rawBulk = context.globals.bulkEntry;
  const bulkEnabled = rawBulk === true || rawBulk === 'true';
  if (typeof window !== 'undefined') {
    CORE_FLAG_KEYS.forEach((key) => {
      window.localStorage.setItem(key, '1');
    });
    BULK_FLAG_KEYS.forEach((key) => {
      if (bulkEnabled) {
        window.localStorage.setItem(key, '1');
      } else {
        window.localStorage.removeItem(key);
      }
    });
  }

  const mode = (context.globals.nurseMode ?? 'ok') as 'ok' | 'partial' | 'error';
  (context as typeof context & { msws?: { handlers: ReturnType<typeof makeNurseHandlers> } }).msws = {
    handlers: makeNurseHandlers(mode),
  };
  const basis = (context.globals.minuteBasis ?? 'utc') as 'utc' | 'local';
  if (typeof window !== 'undefined') {
    (window as typeof window & { __NURSE_MINUTE_BASIS__?: 'utc' | 'local' }).__NURSE_MINUTE_BASIS__ = basis;
    (window as typeof window & { __MSW_NURSE_MODE__?: 'ok' | 'partial' | 'error' }).__MSW_NURSE_MODE__ = mode;
  }
  const routerConfig = context.parameters?.router as { initialEntries?: string[] } | undefined;
  const initialEntries = Array.isArray(routerConfig?.initialEntries) && routerConfig.initialEntries.length > 0
    ? routerConfig.initialEntries
    : ['/'];

  return (
    <ThemeProvider theme={nurseTheme()}>
      <style>{nurseCssVars}</style>
      <CssBaseline />
      <ToastProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: 16 }}>
            <Story {...context.args} />
          </div>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  );
};

const preview: Preview = {
  decorators: [mswDecorator, withNurseProviders],
  parameters: {
    layout: 'fullscreen',
    a11y: {
      element: '#storybook-root',
    },
    controls: { expanded: true },
    options: { storySort: { order: ['Nurse', 'Components'] } },
    msw: {
      handlers: makeNurseHandlers('ok'),
    },
  },
};

export default preview;
