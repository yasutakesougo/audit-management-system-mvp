import { test } from '@playwright/test';
import type { ListSpec } from './listSpecFactory';
import { createListRunner } from './listSpecFactory';

export function runListIntegration<TCreate extends Record<string, unknown>>(spec: ListSpec<TCreate>) {
  test.describe(`[integration][list] ${spec.name}`, () => {
    test.use({
      storageState: 'tests/.auth/storageState.json',
    });

    test(`reachability`, async ({ context }) => {
      const runner = createListRunner(context.request, spec);
      await runner.reachability();
    });

    test(`schema`, async ({ context }) => {
      const runner = createListRunner(context.request, spec);
      await runner.schema();
    });

    test(`idempotent upsert`, async ({ context }) => {
      const runner = createListRunner(context.request, spec);
      await runner.idempotentUpsert();
    });

    test(`deactivate/resolve`, async ({ context }) => {
      const runner = createListRunner(context.request, spec);
      await runner.deactivateIfNeeded();
    });
  });
}
