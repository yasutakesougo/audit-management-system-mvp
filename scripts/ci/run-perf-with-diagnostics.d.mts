export function commandVersion(command: string, args?: string[]): string;

export interface LhciUrlProbe {
  timestamp: string;
  url: string;
  status?: number;
  location?: string | null;
  error?: string;
  elapsedMs: number;
}

export function probeUrl(
  url: string,
  fetchImpl?: typeof fetch,
): Promise<LhciUrlProbe>;
