import { describe, expect, it, vi } from 'vitest';
import { runHealthChecks } from '../checks';
import type { HealthContext, ListSpec } from '../types';
import type { SpAdapter } from '../spAdapter';

// --- Helpers ---

/**
 * Creates an error that mimics SpThrottleRedirectError from spFetch.ts.
 * The error has no numeric `status` property — this is the root cause
 * of the original misclassification as FAIL.
 */
function makeThrottleError(): Error {
  const e = new Error(
    '[SharePoint] Throttled: redirected to Throttle.htm. Retry stopped to avoid request storm.'
  );
  e.name = 'SpThrottleRedirectError';
  return e;
}

function makeHttpError(status: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

// --- Shared fixtures ---

const baseCtx: HealthContext = {
  env: {
    VITE_SP_RESOURCE: 'https://tenant.sharepoint.com',
    VITE_MSAL_CLIENT_ID: 'client-id',
    VITE_MSAL_TENANT_ID: 'tenant-id',
  },
  siteUrl: 'https://tenant.sharepoint.com/sites/test',
  listSpecs: () => [],
  isProductionLike: true,
  autonomyLevel: 'F',
};

/** Mimics the real-world `user_benefit_profile_ext` list that triggered the original issue */
const userBenefitProfileExtSpec: ListSpec = {
  key: 'user_benefit_profile_ext',
  displayName: '利用者給付プロフィール（拡張）',
  resolvedTitle: 'UserBenefit_Profile_Ext',
  requiredFields: [],
  createItem: {},
  updateItem: {},
};

function makePassingSpAdapter(): SpAdapter {
  return {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, title: 'Test User' }),
    getWebTitle: vi.fn().mockResolvedValue('Test Site'),
    getListByTitle: vi.fn().mockResolvedValue({ id: '1', title: 'UserBenefit_Profile_Ext' }),
    getFields: vi.fn().mockResolvedValue([]),
    getItemsTop1: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: 101 }),
    updateItem: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  };
}

// ==========================================================================
// Tests
// ==========================================================================

describe('Health Checks — SharePoint throttling classification', () => {
  // ------------------------------------------------------------------
  // 1. schema.fields.user_benefit_profile_ext — the original regression
  // ------------------------------------------------------------------
  describe('schema.fields.user_benefit_profile_ext (original regression)', () => {
    it('classifies SpThrottleRedirectError on getFields as WARN, not FAIL', async () => {
      const sp = makePassingSpAdapter();
      sp.getFields = vi.fn().mockRejectedValue(makeThrottleError());

      const results = await runHealthChecks(
        { ...baseCtx, listSpecs: () => [userBenefitProfileExtSpec] },
        sp
      );

      const schemaCheck = results.find(
        (r) => r.key === 'schema.fields.user_benefit_profile_ext'
      );
      expect(schemaCheck).toBeDefined();
      expect(schemaCheck?.status).toBe('warn');
      expect(schemaCheck?.summary).toContain('スロットリング');
      expect(schemaCheck?.detail).toContain('throttling');
    });

    it('keeps genuine schema fetch failure as FAIL', async () => {
      const sp = makePassingSpAdapter();
      sp.getFields = vi.fn().mockRejectedValue(
        makeHttpError(500, 'Internal Server Error')
      );

      const results = await runHealthChecks(
        { ...baseCtx, listSpecs: () => [userBenefitProfileExtSpec] },
        sp
      );

      const schemaCheck = results.find(
        (r) => r.key === 'schema.fields.user_benefit_profile_ext'
      );
      expect(schemaCheck).toBeDefined();
      expect(schemaCheck?.status).toBe('fail');
    });
  });

  // ------------------------------------------------------------------
  // 2. permissions.read.user_benefit_profile_ext — the other regression
  // ------------------------------------------------------------------
  describe('permissions.read.user_benefit_profile_ext (original regression)', () => {
    it('classifies SpThrottleRedirectError on getItemsTop1 as WARN, not FAIL', async () => {
      const sp = makePassingSpAdapter();
      sp.getItemsTop1 = vi.fn().mockRejectedValue(makeThrottleError());

      const results = await runHealthChecks(
        { ...baseCtx, listSpecs: () => [userBenefitProfileExtSpec] },
        sp
      );

      const readCheck = results.find(
        (r) => r.key === 'permissions.read.user_benefit_profile_ext'
      );
      expect(readCheck).toBeDefined();
      expect(readCheck?.status).toBe('warn');
      expect(readCheck?.summary).toContain('スロットリング');
    });

    it('keeps 403 Forbidden on read as FAIL', async () => {
      const sp = makePassingSpAdapter();
      sp.getItemsTop1 = vi.fn().mockRejectedValue(
        makeHttpError(403, 'Forbidden')
      );

      const results = await runHealthChecks(
        { ...baseCtx, listSpecs: () => [userBenefitProfileExtSpec] },
        sp
      );

      const readCheck = results.find(
        (r) => r.key === 'permissions.read.user_benefit_profile_ext'
      );
      expect(readCheck).toBeDefined();
      expect(readCheck?.status).toBe('fail');
      expect(readCheck?.summary).toContain('権限がありません');
    });
  });

  // ------------------------------------------------------------------
  // 3. lists.exists — throttling on getListByTitle
  // ------------------------------------------------------------------
  describe('lists.exists — throttling on list existence check', () => {
    it('classifies SpThrottleRedirectError on getListByTitle as WARN', async () => {
      const sp = makePassingSpAdapter();
      sp.getListByTitle = vi.fn().mockRejectedValue(makeThrottleError());

      const results = await runHealthChecks(
        { ...baseCtx, listSpecs: () => [userBenefitProfileExtSpec] },
        sp
      );

      const listCheck = results.find(
        (r) => r.key === 'lists.exists.user_benefit_profile_ext'
      );
      expect(listCheck).toBeDefined();
      expect(listCheck?.status).toBe('warn');
      expect(listCheck?.summary).toContain('スロットリング');
    });

    it('keeps genuine list-not-found as FAIL', async () => {
      const sp = makePassingSpAdapter();
      sp.getListByTitle = vi.fn().mockRejectedValue(
        makeHttpError(404, 'List not found')
      );

      const results = await runHealthChecks(
        { ...baseCtx, listSpecs: () => [userBenefitProfileExtSpec] },
        sp
      );

      const listCheck = results.find(
        (r) => r.key === 'lists.exists.user_benefit_profile_ext'
      );
      expect(listCheck).toBeDefined();
      expect(listCheck?.status).toBe('fail');
    });
  });

  // ------------------------------------------------------------------
  // 4. auth.currentUser — throttling on getCurrentUser
  // ------------------------------------------------------------------
  describe('auth.currentUser — throttling on authentication check', () => {
    it('classifies SpThrottleRedirectError on getCurrentUser as WARN', async () => {
      const sp = makePassingSpAdapter();
      sp.getCurrentUser = vi.fn().mockRejectedValue(makeThrottleError());

      const results = await runHealthChecks(baseCtx, sp);

      const authCheck = results.find((r) => r.key === 'auth.currentUser');
      expect(authCheck).toBeDefined();
      expect(authCheck?.status).toBe('warn');
      expect(authCheck?.summary).toContain('スロットリング');
    });
  });

  // ------------------------------------------------------------------
  // 5. connectivity.web — throttling on getWebTitle
  // ------------------------------------------------------------------
  describe('connectivity.web — throttling on site connectivity check', () => {
    it('classifies SpThrottleRedirectError on getWebTitle as WARN', async () => {
      const sp = makePassingSpAdapter();
      sp.getWebTitle = vi.fn().mockRejectedValue(makeThrottleError());

      const results = await runHealthChecks(baseCtx, sp);

      const webCheck = results.find((r) => r.key === 'connectivity.web');
      expect(webCheck).toBeDefined();
      expect(webCheck?.status).toBe('warn');
      expect(webCheck?.summary).toContain('スロットリング');
    });
  });

  // ------------------------------------------------------------------
  // 6. permissions.create — throttling on createItem
  // ------------------------------------------------------------------
  describe('permissions.create — throttling on create check', () => {
    it('classifies SpThrottleRedirectError on createItem as WARN (no retry amplification)', async () => {
      const sp = makePassingSpAdapter();
      const createFn = vi.fn().mockRejectedValue(makeThrottleError());
      sp.createItem = createFn;

      const results = await runHealthChecks(
        { ...baseCtx, listSpecs: () => [userBenefitProfileExtSpec] },
        sp
      );

      const createCheck = results.find(
        (r) => r.key === 'permissions.create.user_benefit_profile_ext'
      );
      expect(createCheck).toBeDefined();
      expect(createCheck?.status).toBe('warn');
      expect(createCheck?.summary).toContain('スロットリング');
      // safeWithRetry should NOT retry when isThrottled is true
      expect(createFn).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------
  // 7. Ensure existing transient HTTP status handling is preserved
  // ------------------------------------------------------------------
  describe('existing transient HTTP status handling preserved', () => {
    it('still classifies HTTP 429 on update as WARN with retries', async () => {
      const sp = makePassingSpAdapter();
      const updateFn = vi.fn().mockRejectedValue(
        makeHttpError(429, 'Too Many Requests')
      );
      sp.updateItem = updateFn;

      const results = await runHealthChecks(
        { ...baseCtx, listSpecs: () => [userBenefitProfileExtSpec] },
        sp
      );

      const updateCheck = results.find(
        (r) => r.key === 'permissions.update.user_benefit_profile_ext'
      );
      expect(updateCheck?.status).toBe('warn');
      // 429 is retryable, so safeWithRetry should attempt maxRetries+1 = 3 times
      expect(updateFn).toHaveBeenCalledTimes(3);
    });
  });
});
