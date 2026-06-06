import { describe, it, expect } from 'vitest';
import { buildMarkdown, collectRoutes } from '../../scripts/generate-system-map';

describe('System Map Generator', () => {
  it('should generate markdown without throwing exceptions', () => {
    const md = buildMarkdown();
    expect(md).toBeDefined();
    expect(md).toContain('# System Map');
    expect(md).toContain('## 1. Top-level modules');
    expect(md).toContain('## 7. Routing Diagnostics & Consistency');
  });

  it('should capture all routes with nested path resolution and match snapshot', () => {
    const routes = collectRoutes();
    
    // Check that nested path resolution worked correctly
    const kioskToilet = routes.find(r => r.path === 'kiosk/toilet');
    expect(kioskToilet).toBeDefined();
    expect(kioskToilet?.file).toContain('kioskRoutes.tsx');

    // Check that dynamic Hub routes are detected from the runtime configuration
    const planningHub = routes.find(r => r.path === 'planning');
    expect(planningHub).toBeDefined();
    expect(planningHub?.file).toContain('hubRoutes.tsx');

    // Snapshot check for route inventory to guard against regressions
    const simplifiedRoutes = routes.map(r => ({
      path: r.path,
      file: r.file
    }));
    expect(simplifiedRoutes).toMatchSnapshot();
  });
});
