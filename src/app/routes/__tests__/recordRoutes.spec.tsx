import { describe, expect, it } from 'vitest';

import { recordRoutes } from '../recordRoutes';

describe('recordRoutes', () => {
  it('exposes the record quality human review workflow route under records', () => {
    const route = recordRoutes.find(item => item.path === 'records/quality-review');

    expect(route).toBeDefined();
    expect(route?.element).toBeTruthy();
  });
});
