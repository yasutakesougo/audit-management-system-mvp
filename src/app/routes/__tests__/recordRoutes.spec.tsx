import { describe, expect, it } from 'vitest';

import ProtectedRoute from '@/app/ProtectedRoute';
import { recordRoutes } from '../recordRoutes';

describe('recordRoutes', () => {
  it('exposes the record quality human review workflow route under records', () => {
    const route = recordRoutes.find(item => item.path === 'records/quality-review');

    expect(route).toBeDefined();
    expect(route?.element).toBeTruthy();
  });

  it('protects the direct billing route with the shared authentication gate', () => {
    const route = recordRoutes.find(item => item.path === 'billing');

    expect(route).toBeDefined();
    expect(route?.element?.type).toBe(ProtectedRoute);
  });
});
