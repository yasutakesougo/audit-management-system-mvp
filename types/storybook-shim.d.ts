declare module '@storybook/react' {
  import type { ReactElement } from 'react';

  export type Meta<T> = {
    title: string;
    component: T;
    tags?: string[];
    args?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    render?: (args: Record<string, unknown>) => ReactElement | null;
  };

  export type StoryObj<T> = {
    component?: T;
    name?: string;
    args?: Record<string, unknown>;
    render?: (args: Record<string, unknown>) => ReactElement | null;
    play?: (context: { canvasElement: HTMLElement }) => Promise<void> | void;
    parameters?: Record<string, unknown>;
  };
}

declare module '@storybook/test' {
  export const expect: typeof import('vitest')['expect'];
  export const userEvent: Record<string, (...args: unknown[]) => Promise<unknown> | unknown>;
  export const within: (element: HTMLElement) => Record<string, (...args: unknown[]) => unknown>;
  export const screen: Record<string, (...args: unknown[]) => unknown>;
}
