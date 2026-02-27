import { NavAudience } from '@/app/config/navigationConfig';
import { computeNavigationDiagnostics } from '@/app/navigation/diagnostics/navigationDiagnostics';
import { describe, expect, it } from 'vitest';

describe('Nav ↔ Router Consistency', () => {
  // ---------------------------------------------------------------------------
  // Feature Flag matrices to ensure we test all possible conditional routes
  // ---------------------------------------------------------------------------
  const featureMatrices = [
    { schedulesEnabled: true, complianceFormEnabled: true, icebergPdcaEnabled: true, staffAttendanceEnabled: true, todayOpsEnabled: true },
    { schedulesEnabled: false, complianceFormEnabled: false, icebergPdcaEnabled: false, staffAttendanceEnabled: false, todayOpsEnabled: false },
  ];

  const roles: NavAudience[] = ['admin', 'staff', 'reception', 'all'];

  it('A: All Nav hrefs exist in router (Nav -> Router)', () => {
    const missingPaths = new Set<string>();

    for (const flags of featureMatrices) {
      for (const role of roles) {
        const diagnostics = computeNavigationDiagnostics({
          role,
          ...flags,
        });

        for (const missing of diagnostics.missingInRouter) {
          missingPaths.add(missing);
        }
      }
    }

    expect(
      Array.from(missingPaths),
      `Found Nav items pointing to non-existent Router paths: \n${Array.from(missingPaths).join('\n')}`
    ).toEqual([]);
  });

  it('B: No orphan routes (Router -> Nav/Footer or Allowlist)', () => {
    const orphanPaths = new Set<string>();

    // If an orphan exists in ANY configuration, it is an actual orphan
    // We aggregate them to ensure that paths not exposed *at all* are called out

    // First, start by assuming every router path might be an orphan, and then remove it if it's exposed anywhere
    let universalOrphans: string[] | null = null;

    for (const flags of featureMatrices) {
      for (const role of roles) {
        const diagnostics = computeNavigationDiagnostics({
          role,
          ...flags,
        });

        if (universalOrphans === null) {
            universalOrphans = [...diagnostics.orphanRoutes];
        } else {
            // Intersect: it's only a true orphan if it's an orphan across ALL configs
            universalOrphans = universalOrphans.filter(p => diagnostics.orphanRoutes.includes(p));
        }
      }
    }

    if (universalOrphans) {
        for (const orphan of universalOrphans) {
            orphanPaths.add(orphan);
        }
    }

    // Empty array means no true orphans were found that weren't allowlisted
    expect(
      Array.from(orphanPaths),
      `Found Router paths that are NOT exposed in Nav/Footer across ANY configuration, and NOT in the allowlist. Are these orphan routes? \n${Array.from(orphanPaths).join('\n')}`
    ).toEqual([]);
  });
});
