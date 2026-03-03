import { getFeatureFlags } from '@/config/featureFlags';
import { isDemoModeEnabled } from '@/lib/env';

import type { PdcaRepository } from './domain/pdcaRepository';
import { InMemoryPdcaRepository } from './infra/inMemoryPdcaRepository';
import { SharePointPdcaRepository } from './infra/SharePointPdcaRepository';

type PdcaRepositoryKind = 'in-memory' | 'sharepoint';

let cached: { kind: PdcaRepositoryKind; repo: PdcaRepository } | null = null;

const isAutomationRuntime = (): boolean => {
  if (typeof navigator !== 'undefined' && navigator.webdriver) {
    return true;
  }
  if (typeof window !== 'undefined') {
    const automationHints = window as Window & { __PLAYWRIGHT__?: unknown; Cypress?: unknown };
    if (automationHints.__PLAYWRIGHT__ || automationHints.Cypress) {
      return true;
    }
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITEST === '1' || process.env.PLAYWRIGHT_TEST === '1') {
      return true;
    }
  }
  return false;
};

const resolveKind = (): PdcaRepositoryKind => {
  const { icebergPdca } = getFeatureFlags();
  if (!icebergPdca) return 'in-memory';
  if (isDemoModeEnabled() || isAutomationRuntime()) {
    return 'in-memory';
  }
  return 'sharepoint';
};

const createRepository = (kind: PdcaRepositoryKind): PdcaRepository => {
  if (kind === 'sharepoint') return new SharePointPdcaRepository();
  return new InMemoryPdcaRepository();
};

export const getPdcaRepository = (): PdcaRepository => {
  const kind = resolveKind();

  if (cached && cached.kind === kind) {
    return cached.repo;
  }

  const repo = createRepository(kind);
  cached = { kind, repo };
  return repo;
};
