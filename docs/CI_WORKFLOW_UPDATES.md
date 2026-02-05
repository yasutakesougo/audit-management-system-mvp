# CI/CD Workflow Updates - February 2026

## Overview

This document summarizes the major CI/CD improvements implemented to enhance test stability, environment differentiation, and developer experience.

## Key Changes

### 1. Test Categorization

**Smoke Tests (Fast Feedback)**
- File: `.github/workflows/smoke.yml`
- Purpose: Quick validation on every PR
- Target time: < 20 minutes
- Test pattern: `*.smoke.spec.ts` (~29 tests)
- Retry policy: 1 retry maximum
- Triggers: PR open, synchronize, ready_for_review

**Deep Tests (Comprehensive Coverage)**
- File: `.github/workflows/e2e-deep.yml`
- Purpose: Thorough testing of complex scenarios
- Target time: < 45 minutes
- Test pattern: All E2E tests except smoke (~83 tests)
- Retry policy: 2 retries maximum
- Triggers: Push to main, PR to main, nightly (2 AM UTC), manual dispatch

### 2. Environment Differentiation

Three distinct environment configurations:

**Development (`.env.dev`)**
- Local development with hot reload
- Dev harness enabled
- Full debugging capabilities

**E2E Dev (`.env.e2e.dev`)**
- E2E test development
- Dev server for fast iteration
- Mock authentication and APIs

**E2E Preview (`.env.e2e.preview`)**
- CI/CD testing environment
- Production build via preview server
- Optimized for CI performance
- Strict environment isolation

### 3. Enhanced Failure Handling

**Artifact Uploads:**
- Always: HTML reports, JUnit reports, test summaries
- On failure: Screenshots, videos, traces, server logs
- On partial failure: Flaky test artifacts, retry logs

**Retention Policies:**
- Smoke tests: 7 days
- Deep tests: 14 days
- Failure artifacts: 14 days
- Flaky test reports: 30 days

### 4. Flaky Test Monitoring

**Automatic Detection:**
- Detects tests requiring retries
- Analyzes retry patterns
- Generates severity ratings (LOW/MEDIUM/HIGH)

**Reporting:**
- GitHub Actions summary with flaky test count
- Detailed markdown reports in artifacts
- Automated analysis script: `scripts/analyze-flaky-tests.mjs`

**Severity Levels:**
- LOW: 0-2 total retries (acceptable)
- MEDIUM: 3-5 total retries (monitor)
- HIGH: 6+ total retries (immediate action)

### 5. Improved DX

**Better Feedback:**
- Structured test summaries in GitHub Actions
- Clear environment scope in logs
- Detailed failure diagnostics

**Faster Iteration:**
- Smoke tests run first for quick feedback
- Parallel job execution where possible
- Conditional deep test execution

**Documentation:**
- CI Test Stability Strategy: `docs/CI_TEST_STABILITY_STRATEGY.md`
- Flaky Test Runbook: `docs/FLAKY_TEST_RUNBOOK.md`
- Environment configuration guide in strategy doc

## Migration Guide

### For Developers

**No changes required** for existing tests. The new workflows are backward compatible.

**Optional improvements:**
1. Tag new fast tests as smoke tests: `*.smoke.spec.ts`
2. Use environment configs for local development: `cp .env.dev .env.local`
3. Review flaky test reports in PR artifacts

### For CI/CD Maintainers

**New workflows to monitor:**
1. `.github/workflows/smoke.yml` - Runs on every PR
2. `.github/workflows/e2e-deep.yml` - Runs on main and nightly

**Old workflows to review:**
- Ensure no conflicts with new workflows
- Consider deprecating duplicate test jobs
- Update branch protection rules if needed

## Usage Examples

### Run Smoke Tests Locally

```bash
# Using npm scripts
npm run test:e2e:smoke

# Direct Playwright command
npx playwright test --project=smoke
```

### Run Deep Tests Locally

```bash
# All deep tests (non-smoke)
npx playwright test tests/e2e --grep-invert smoke

# Specific test file
npx playwright test tests/e2e/dashboard-logic-integration.spec.ts
```

### Analyze Flaky Tests

```bash
# After running tests locally
node scripts/analyze-flaky-tests.mjs

# In CI, reports are automatically generated and uploaded as artifacts
```

### Test with Environment Configs

```bash
# Dev environment
cp .env.dev .env.local
npm run dev

# E2E preview environment (like CI)
cp .env.e2e.preview .env.local
npm run build
npm run preview
```

## Metrics to Track

### Test Performance
- Smoke test average duration
- Deep test average duration
- CI queue time

### Test Stability
- Flaky test rate per week
- Retry frequency per test
- Test failure rate

### Developer Experience
- Time from commit to feedback
- False positive rate
- Test maintenance overhead

## Next Steps

1. **Week 1-2:** Monitor new workflows, adjust retry policies if needed
2. **Week 3-4:** Review flaky test reports, fix high-severity issues
3. **Month 2:** Optimize test categorization based on data
4. **Quarter 1:** Comprehensive review and documentation update

## Rollback Plan

If issues arise:

1. **Disable new workflows:**
   - Comment out workflow triggers in YAML
   - Revert to previous workflows

2. **Revert changes:**
   ```bash
   git revert <commit-hash>
   ```

3. **Emergency fix:**
   - Edit workflow files directly in GitHub UI
   - Push hotfix to disable problematic jobs

## Related Documentation

- [CI Test Stability Strategy](docs/CI_TEST_STABILITY_STRATEGY.md)
- [Flaky Test Runbook](docs/FLAKY_TEST_RUNBOOK.md)
- [Playwright Configuration](playwright.config.ts)
- [Smoke Test Configuration](playwright.smoke.config.ts)

## Questions or Issues?

- Create a GitHub issue with label `ci/cd`
- Tag @maintainers in PR comments
- Check existing documentation in `docs/` directory

## Changelog

- **2026-02-03:** Initial implementation of CI test stability improvements
  - Added smoke and deep test workflows
  - Created environment configuration files
  - Implemented flaky test detection and reporting
  - Added comprehensive documentation
