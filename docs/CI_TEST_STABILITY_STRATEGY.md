# CI Test Stability Strategy

## Overview

This document outlines the comprehensive strategy for improving CI test stability in the audit-management-system-mvp repository. The strategy focuses on test categorization, environment differentiation, failure handling, and flaky test monitoring.

## Test Categorization

### Smoke Tests (Fast Feedback)
**Purpose:** Provide rapid feedback on PRs to catch obvious regressions early.

**Characteristics:**
- Run on every PR
- Target execution time: < 20 minutes
- Focus on critical paths and basic functionality
- Limited retries (1 retry max)
- Run in parallel where possible

**Test Files:**
All tests matching the pattern `*.smoke.spec.ts` are considered smoke tests:
- `tests/e2e/app-shell.smoke.spec.ts`
- `tests/e2e/router.smoke.spec.ts`
- `tests/e2e/nav.smoke.spec.ts`
- `tests/e2e/dashboard.smoke.spec.ts`
- And 25+ other smoke test files

**Workflow:** `.github/workflows/smoke.yml`

**Triggers:**
- Every PR (opened, synchronize, reopened, ready_for_review)
- Manual dispatch for debugging

### Deep Tests (Comprehensive Coverage)
**Purpose:** Comprehensive end-to-end testing covering complex scenarios and edge cases.

**Characteristics:**
- Run on main branch pushes, nightly, and critical PRs
- Target execution time: < 45 minutes
- Cover integration scenarios, complex flows, and edge cases
- More retries allowed (2 retries)
- Includes performance and accessibility tests

**Test Files:**
All E2E tests that are NOT smoke tests (~83 test files):
- `tests/e2e/dashboard-logic-integration.spec.ts`
- `tests/e2e/cross-module-navigation.spec.ts`
- `tests/e2e/users-basic-edit-flow.spec.ts`
- `tests/e2e/schedule-week.deeplink.spec.ts`
- And many more comprehensive test files

**Workflow:** `.github/workflows/e2e-deep.yml`

**Triggers:**
- Push to main branch
- PR to main branch
- Nightly schedule (2 AM UTC / 11 AM JST)
- Manual dispatch with custom test patterns

## Environment Differentiation

### Three Distinct Environments

#### 1. Development Environment (`dev`)
**Purpose:** Local development with hot reload and developer tools

**Configuration:** `.env.dev`
- Dev server on port 5173
- Hot module reload enabled
- Demo mode with in-memory stores
- SharePoint mocked
- Debug flags available

**Use Cases:**
- Local feature development
- Interactive debugging
- Component development

#### 2. E2E Environment (`e2e`)
**Purpose:** E2E test development and debugging

**Configuration:** `.env.e2e.dev`
- Dev server for test development
- E2E flags enabled
- Mock authentication
- Isolated from production resources
- Explicit E2E environment scope

**Use Cases:**
- Writing new E2E tests
- Debugging test failures locally
- Test fixture development

#### 3. Preview Environment (`preview`)
**Purpose:** CI/CD testing with production-like builds

**Configuration:** `.env.e2e.preview`
- Production build served via preview server
- Optimized for CI performance
- Minimal dev harness
- Strict environment isolation

**Use Cases:**
- Smoke tests in CI
- Deep tests in CI
- Pre-deployment validation

### Environment Variable Scoping

Each environment has clear boundaries:

**Dev-only variables:**
- `DEV_ENVIRONMENT_SCOPE=local`
- `VITE_DEV_HARNESS=1`
- `VITE_AUDIT_DEBUG=1` (optional)

**E2E-only variables:**
- `E2E_ENVIRONMENT_SCOPE=dev|preview`
- `VITE_E2E=1`
- `E2E_FEATURE_*` flags

**Preview-only variables:**
- `E2E_ENVIRONMENT_SCOPE=preview`
- `VITE_DEV_HARNESS=0`

### Secret Management

**Principles:**
1. No secrets in E2E environments (use mocks)
2. Secrets only for integration tests (nightly)
3. Environment-specific secret prefixes

**Secret Categories:**

**CI/CD Secrets (GitHub Actions only):**
- `VITE_SP_SCOPE_DEFAULT` - SharePoint scope for integration tests
- `NOTIFY_WEBHOOK_URL` - Failure notification webhook

**Integration Test Secrets (nightly/manual only):**
- Real SharePoint credentials
- Real MSAL configuration
- Access tokens

**Local Development (not committed):**
- `.env.local` - Developer-specific overrides
- Never commit real credentials

## Re-run Strategies

### Retry Configuration by Test Type

**Smoke Tests:**
```yaml
retries: 1  # Quick retry for transient failures
timeout: 60_000  # 60 seconds per test
```

**Deep Tests:**
```yaml
retries: 2  # More retries for complex scenarios
timeout: 60_000  # 60 seconds per test
```

**Integration Tests:**
```yaml
retries: 1  # Limited retries (real API calls)
timeout: 90_000  # 90 seconds (network calls)
```

### Retry Strategy Guidelines

1. **First attempt fails:** Immediate retry
2. **Second attempt fails:** Log as potentially flaky
3. **All attempts fail:** Report failure with full diagnostics

### Conditional Re-runs

Tests can be re-run on:
- Network timeouts
- Server startup issues
- Transient DOM state issues

Tests should NOT be re-run on:
- Assertion failures (logic bugs)
- Build failures
- Missing elements (test bugs)

## Flaky Test Monitoring

### Detection Mechanisms

**Automatic Detection:**
1. Playwright retry artifacts (`*-retry*` directories)
2. JUnit report analysis
3. GitHub Actions summary reports

**Detection Workflow:**
```yaml
- name: Detect flaky tests
  run: |
    retried=$(find test-results -name "*-retry*" -type d | wc -l)
    if [ "$retried" -gt 0 ]; then
      echo "⚠️ $retried test(s) required retry"
    fi
```

### Flaky Test Reports

Each test run generates a flaky test report in the GitHub Actions summary:

```
## Flaky Test Detection

⚠️ **Warning:** 3 test(s) required retry

Please investigate these potentially flaky tests:
- tests/e2e/schedule-week-retry1
- tests/e2e/dashboard-smoke-retry1
- tests/e2e/users-detail-flow-retry2
```

### Investigation Process

When a flaky test is detected:

1. **Immediate:** Review the test artifacts
2. **Short-term:** Add `test.fail()` or `test.skip()` with issue reference
3. **Medium-term:** Investigate root cause (timing, state, network)
4. **Long-term:** Fix or remove the test

### Flaky Test Threshold

**Acceptable:** 0-2 retries per test run
**Warning:** 3-5 retries per test run
**Critical:** 6+ retries per test run (investigate immediately)

## Artifact Management

### Artifact Upload Strategy

**Always Upload:**
- Playwright HTML reports
- JUnit XML reports
- Test result summaries

**Upload on Failure:**
- Screenshots
- Videos
- Trace files
- Server logs

**Upload on Partial Failure:**
- Flaky test artifacts
- Retry attempt logs
- Performance metrics

### Artifact Retention

**Smoke Tests:** 7 days
**Deep Tests:** 14 days
**Integration Tests:** 14 days
**Failure Artifacts:** 14 days

### Artifact Structure

```
playwright-artifacts-smoke-<run-number>/
├── playwright-report/
│   ├── index.html
│   └── data/
├── test-results/
│   ├── junit-e2e-smoke-core.xml
│   ├── junit-e2e-smoke-all.xml
│   └── <test-name>/
│       ├── test-failed-1.png
│       ├── trace.zip
│       └── video.webm
└── logs/
    └── server.log
```

## Audit Logs and Scope Clarity

### Test Execution Audit Trail

Each test run includes detailed audit information:

**Run Metadata:**
- Workflow name and trigger
- Environment scope (dev/e2e/preview)
- Test category (smoke/deep)
- Timestamp and duration

**Test Scope:**
- Total tests executed
- Tests passed/failed/skipped
- Retry count per test
- Flaky test detection

**Environment Context:**
- Node.js version
- Playwright version
- Environment variables (non-sensitive)
- Feature flags enabled

### GitHub Actions Summary

Each workflow generates a structured summary:

```markdown
## Smoke Test Results

**Environment:** preview
**Core Smoke Tests:** success
**All Smoke Tests:** success

**Total Smoke Tests:** 29
**Failures:** 0

## Flaky Test Detection (Smoke)

✅ No retries - all smoke tests stable
```

### Audit Log Retention

- GitHub Actions logs: 90 days
- Artifacts with JUnit reports: 14 days
- Performance metrics: Stored in separate repo

## Developer Experience (DX) Improvements

### Quick Reference Commands

**Local Development:**
```bash
# Start dev server
npm run dev

# Run smoke tests locally
npm run test:e2e:smoke

# Run specific test
npm run test:e2e -- tests/e2e/dashboard.smoke.spec.ts
```

**CI Testing:**
```bash
# Test with preview build (like CI)
npm run build
npm run preview &
npm run test:e2e:smoke

# Test specific pattern
npm run test:e2e -- --grep "dashboard"
```

### Troubleshooting Guide

**Test fails locally but passes in CI:**
1. Check environment variables (.env.local vs .env.e2e.preview)
2. Verify Node.js and browser versions match CI
3. Check for timing issues (CI might be slower)

**Test passes locally but fails in CI:**
1. Review CI environment logs
2. Download and review trace files
3. Check for resource constraints (memory, CPU)

**Flaky test detected:**
1. Review retry artifacts
2. Add explicit waits if timing-related
3. Check for state pollution between tests
4. Consider isolating test data

### Documentation Links

- **Playwright Config:** `playwright.config.ts`
- **Smoke Config:** `playwright.smoke.config.ts`
- **Environment Files:** `.env.*` files
- **Workflow Files:** `.github/workflows/*.yml`

## Maintenance and Evolution

### Regular Reviews

**Weekly:**
- Review flaky test reports
- Monitor test execution times
- Check artifact storage usage

**Monthly:**
- Review and update test categorization
- Audit environment configurations
- Update retry strategies based on data

**Quarterly:**
- Comprehensive test suite review
- Performance optimization
- Documentation updates

### Metrics to Track

1. **Test Stability:**
   - Flaky test rate per week
   - Retry frequency per test
   - Test failure rate

2. **Test Performance:**
   - Average smoke test duration
   - Average deep test duration
   - CI queue time

3. **Developer Experience:**
   - Time from commit to feedback
   - False positive rate
   - Test maintenance overhead

### Continuous Improvement

This strategy is a living document. As we learn from CI runs and test failures:

1. Update retry strategies
2. Refine test categorization
3. Improve environment isolation
4. Enhance failure diagnostics

## Conclusion

This comprehensive strategy provides:
- ✅ Clear test categorization (smoke vs deep)
- ✅ Environment differentiation (dev, e2e, preview)
- ✅ Robust failure handling and artifact management
- ✅ Flaky test monitoring and reporting
- ✅ Improved developer experience

By following this strategy, we ensure stable, fast, and reliable CI/CD pipelines that give developers confidence in their changes.
