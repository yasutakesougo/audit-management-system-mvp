import { test } from '@playwright/test';
import type { ListSpec } from './listSpecFactory';
import { createListRunner } from './listSpecFactory';

export function runListIntegration<TCreate extends Record<string, unknown>>(spec: ListSpec<TCreate>) {
  test.describe(`[integration][list] ${spec.name}`, () => {
    test(`reachability`, async ({ request }) => {
      const runner = createListRunner(request, spec);
      await runner.reachability();
    });

    test(`schema`, async ({ request }) => {
      const runner = createListRunner(request, spec);
      await runner.schema();
    });

    test(`idempotent upsert`, async ({ request }) => {
      const runner = createListRunner(request, spec);
      await runner.idempotentUpsert();
    });

    test(`deactivate/resolve`, async ({ request }) => {
      const runner = createListRunner(request, spec);
      await runner.deactivateIfNeeded();
    });
  });
}
