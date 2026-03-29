/**
 * SupportPlanDraftRepository — Repository Factory
 *
 * Uses the generic `createRepositoryFactory` builder.
 * Automatically selects InMemory (demo) or SharePoint (production) based on environment.
 */

import type { BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import { createRepositoryFactory } from '@/lib/createRepositoryFactory';
import { ensureConfig } from '@/lib/sp/config';
import { createSpClient } from '@/lib/spClient';

import type { SupportPlanDraftRepository } from './domain/SupportPlanDraftRepository';
import {
    createInMemorySupportPlanDraftRepository,
    inMemorySupportPlanDraftRepository,
} from './infra/InMemorySupportPlanDraftRepository';
import {
    SharePointSupportPlanDraftRepository,
} from './infra/Legacy/SharePointSupportPlanDraftRepository';

// ────────────────────────────────────────────────────────────────────────────
// Factory Options
// ────────────────────────────────────────────────────────────────────────────

export interface SupportPlanDraftFactoryOptions extends BaseFactoryOptions {
  /** Override the SharePoint list title. */
  listTitle?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Factory Instance
// ────────────────────────────────────────────────────────────────────────────

const factory = createRepositoryFactory<SupportPlanDraftRepository, SupportPlanDraftFactoryOptions>({
  name: 'SupportPlanDraft',
  createDemo: () => inMemorySupportPlanDraftRepository,
  createReal: (opts) => {
    const { baseUrl } = ensureConfig();
    const client = createSpClient(opts.acquireToken!, baseUrl);
    return new SharePointSupportPlanDraftRepository({
      spFetch: client.spFetch,
      listTitle: opts.listTitle,
    });
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/** Get repository instance (plain function — requires acquireToken for production). */
export const getSupportPlanDraftRepository = factory.getRepository;

/** React Hook: auto-provides acquireToken from auth context. */
export const useSupportPlanDraftRepository = factory.useRepository;

/** Override repository for testing. */
export const overrideSupportPlanDraftRepository = factory.override;

/** Reset factory caches and overrides. */
export const resetSupportPlanDraftRepository = factory.reset;

/** Get current repository kind ('demo' | 'real'). */
export const getCurrentSupportPlanDraftRepositoryKind = factory.getCurrentKind;

// Re-export for convenience
export { createInMemorySupportPlanDraftRepository };
