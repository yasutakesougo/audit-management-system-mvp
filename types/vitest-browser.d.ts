// Type declarations to resolve Vitest browser module resolution issues
// This file addresses TypeScript module resolution errors with vitest/browser

declare module 'vitest/browser' {
  export interface BrowserCommands {
    // Add minimal browser command interface to satisfy type requirements
    [key: string]: unknown;
  }

  export const commands: BrowserCommands;
}

// Additional type fixes for Vitest internal types
declare module 'vitest/optional-types.js' {
  export const happyDomTypes: string[];
  export const jsdomTypes: string[];
}