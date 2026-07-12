export interface PlaywrightStorageState {
  readonly cookies: ReadonlyArray<Record<string, unknown>>;
  readonly origins?: ReadonlyArray<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export function decodeStorageState(encoded: unknown): PlaywrightStorageState;

export function restoreStorageState(encoded: unknown, outputPath?: string): string;
