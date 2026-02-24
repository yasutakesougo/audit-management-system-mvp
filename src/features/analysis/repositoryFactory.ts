import { getFeatureFlags } from '@/config/featureFlags';
import { isDemoModeEnabled } from '@/lib/env';

import type { IcebergAnalysisRepository } from './domain/icebergAnalysisRepository';
import { InMemoryIcebergAnalysisRepository } from './infra/InMemoryIcebergAnalysisRepository';
import { SharePointIcebergAnalysisRepository } from './infra/SharePointIcebergAnalysisRepository';

type RepositoryKind = 'in-memory' | 'sharepoint';

let cached: { kind: RepositoryKind; repo: IcebergAnalysisRepository } | null = null;

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

const resolveKind = (): RepositoryKind => {
  const { icebergAnalysis } = getFeatureFlags();
  if (!icebergAnalysis) return 'in-memory';
  if (isDemoModeEnabled() || isAutomationRuntime()) {
    return 'in-memory';
  }
  return 'sharepoint';
};

const createRepository = (kind: RepositoryKind): IcebergAnalysisRepository => {
  if (kind === 'sharepoint') return new SharePointIcebergAnalysisRepository();
  return new InMemoryIcebergAnalysisRepository();
};

export const getIcebergAnalysisRepository = (): IcebergAnalysisRepository => {
  const kind = resolveKind();

  if (cached && cached.kind === kind) {
    return cached.repo;
  }

  const repo = createRepository(kind);
  cached = { kind, repo };
  return repo;
};
