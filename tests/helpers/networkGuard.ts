import type { Page } from '@playwright/test';

type GuardMode = 'allowlist-localhost' | 'off';

/**
 * Network Guard for E2E and Integration tests.
 *
 * - E2E: Use 'allowlist-localhost' to enforce zero external calls (localhost/127 + data/blob only)
 * - Integration: Use 'off' to allow real SharePoint/Graph communication
 *
 * @example
 * // E2E (strict)
 * const guard = installNetworkGuard(page, 'allowlist-localhost');
 * // ... test actions ...
 * guard?.assertNoViolations(); // optional post-check
 *
 * @example
 * // Integration (permissive)
 * installNetworkGuard(page, 'off'); // no-op
 */
export const installNetworkGuard = (
  page: Page,
  mode: GuardMode,
  opts?: { allowExtraHosts?: string[] }
) => {
  if (mode === 'off') return undefined;

  const allowedHosts = new Set<string>(['localhost', '127.0.0.1']);
  for (const h of opts?.allowExtraHosts ?? []) allowedHosts.add(h);

  const allowedSchemes = new Set<string>(['http:', 'https:', 'data:', 'blob:']);
  const violations: string[] = [];

  page.on('request', (req) => {
    const url = req.url();

    // data/blob have no hostname, allow immediately
    if (url.startsWith('data:') || url.startsWith('blob:')) return;

    let u: URL;
    try {
      u = new URL(url);
    } catch {
      violations.push(url);
      throw new Error(`Network guard blocked non-URL request: ${url}`);
    }

    if (!allowedSchemes.has(u.protocol)) {
      violations.push(url);
      throw new Error(`Network guard blocked unsupported protocol: ${url}`);
    }

    if (!allowedHosts.has(u.hostname)) {
      violations.push(url);
      throw new Error(`Network guard blocked external call: ${url}`);
    }
  });

  return {
    /**
     * Optional post-test check for violations.
     * Throws if any non-allowed requests were made.
     */
    assertNoViolations: () => {
      if (violations.length) {
        throw new Error(
          [
            'E2E tests must NOT call external hosts (allowlist-localhost mode).',
            'Violations:',
            ...violations.map((v) => `  - ${v}`),
          ].join('\n')
        );
      }
    },
  };
};
