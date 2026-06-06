# Bundle Budget Review Runbook

## Purpose

This runbook governs changes to bundle budgets in
`scripts/assert-chunk-size.mjs`. A budget is a regression guard, not a value
that should automatically follow the latest build output.

Use this process when:

- a dependency update changes a monitored chunk;
- `vite.config.ts` changes browser targets, aliases, or chunk boundaries;
- a monitored chunk is added, removed, renamed, split, or merged;
- `npm run build:ci` fails because a chunk exceeds its budget;
- the scheduled review identifies a sustained size trend.

## Ownership And Review Cycle

| Activity | Owner | Timing |
| --- | --- | --- |
| Review a budget-changing PR | PR author and one maintainer | Every applicable PR |
| Compare modern and legacy output | PR author | Every applicable PR |
| Review monitored targets and headroom | Repository maintainer | Quarterly |
| Reassess browser targets | Repository maintainer | At least annually, or when product support changes |

The reviewer approving a budget increase must not rely only on a passing
`build:ci` result. The PR must include the measurements and justification
defined below.

## Standard Measurement

Run measurements from an up-to-date `main` branch with the same Node and
package-lock state used by CI.

```bash
npm ci
npm run build:ci
```

Record the `bundle:check` and `bundle:assert` output from the PR branch.
For a meaningful comparison, run the same commands on the base commit or use
the most recent successful CI output produced from that commit.

Do not compare:

- a development build with a production build;
- builds using different environment feature flags;
- a cached local build with a clean CI build;
- only the modern chunk when a legacy counterpart exists.

## Decision Rules

### No budget change

Keep the existing budget when:

- the chunk remains within budget;
- the increase is caused by accidental eager loading or a lost lazy boundary;
- an import, locale, polyfill, or extension can be removed without changing
  required behavior;
- the chunk name disappeared unexpectedly and the required-target guard fails.

Fix the implementation or chunk boundary instead.

### Budget decrease

Lower the budget when a reduction is stable across two clean builds and leaves
reasonable build variation headroom. Prefer a round value that remains close
enough to detect a meaningful regression.

### Budget increase

An increase is allowed only when all of the following are documented:

1. The user-facing or compatibility requirement causing the increase.
2. Before and after sizes for both modern and legacy assets.
3. The absolute and percentage change.
4. Alternatives considered, including lazy loading or dependency removal.
5. Why the increase cannot reasonably be avoided in the current change.
6. A reviewer-approved new limit with explicit headroom.

Do not increase a budget solely because CI is red or because a dependency
upgrade produced a larger artifact.

## Modern And Legacy Review

`vite.config.ts` currently targets `es2019` and `safari13`, so the build
produces modern and legacy assets.

For every monitored pair:

- confirm both files are present;
- record both sizes;
- explain material differences between them;
- use separate limits when transpilation or polyfills create a persistent
  difference;
- do not use the larger legacy limit to weaken the modern limit.

If browser targets change:

1. State the old and new target lists.
2. Run `npm run build:ci` before and after the target change.
3. Compare the top ten artifacts and every required budget target.
4. Identify polyfill or transpilation changes.
5. Update budgets only after the browser support decision is approved.

Removing legacy output requires an explicit product support decision. It must
not be done only to make bundle checks pass.

## Dependency Update Checklist

Add this checklist to dependency-update PRs that affect runtime packages:

```markdown
## Bundle impact

- [ ] Ran `npm run build:ci`
- [ ] Compared the PR branch with the base commit under the same conditions
- [ ] Recorded modern and legacy sizes for affected monitored chunks
- [ ] Checked for lost lazy-loading or changed chunk boundaries
- [ ] Confirmed required budget targets are still detected
- [ ] Explained every budget change, including alternatives considered
- [ ] Updated the bundle baseline or runbook when support assumptions changed
```

## Required PR Evidence

Use this table in a PR that changes a budget:

| Asset | Base | PR | Change | Current budget | Proposed budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| Modern asset | 0.0 kB | 0.0 kB | +0.0% | 0 kB | 0 kB |
| Legacy asset | 0.0 kB | 0.0 kB | +0.0% | 0 kB | 0 kB |

The PR description must also include:

- reason for the size change;
- rejected alternatives;
- browser-support impact;
- reviewer responsible for accepting the new baseline;
- follow-up issue when the increase is accepted temporarily.

## Quarterly Review

Once per quarter:

1. Inspect recent successful `build:ci` runs.
2. Compare actual sizes with configured limits.
3. Identify budgets with excessive unused headroom.
4. Identify stable vendor or page chunks suitable for explicit monitoring.
5. Lower budgets after sustained reductions.
6. Create follow-up issues for unexplained growth.

The review should produce either a small budget-adjustment PR with evidence or
a comment on the tracking issue stating that no changes are required.

## Monitored Targets Baseline (2026-06-06)

The following table records the current actual sizes and configured limits for all monitored modern and legacy chunks. Usage indicates the headroom ratio (`actual / limit`).

| Chunk | Modern actual | Modern limit | Legacy actual | Legacy limit | Usage | Reason |
|---|---:|---:|---:|---:|---:|---|
| application shell | 539.9 kB | 800 kB | 525.3 kB | 800 kB | ~67% | Main application entry |
| PDF renderer | 1540.2 kB | 1750 kB | 1517.5 kB | 1750 kB | ~88% | Heavy PDF generation runtime |
| BlockNote editor | 992.7 kB | 1100 kB | 1195.7 kB | 1250 kB | ~96% | Rich text block editor |
| Excel export | 917.2 kB | 1000 kB | 912.8 kB | 1000 kB | ~92% | Excel schema generation runtime |
| React Core | 676.2 kB | 850 kB | 667.3 kB | 850 kB | ~80% | React core libraries |
| MUI Framework | 555.5 kB | 700 kB | 544.9 kB | 700 kB | ~79% | Material UI and styles |
| Firebase SDK | 379.4 kB | 480 kB | 559.1 kB | 700 kB | ~80% | Firebase client runtime |
| SupportPlanningSheetPage | 260.5 kB | 330 kB | 259.5 kB | 330 kB | ~79% | Key creation screen |
| MonthlyRecordPage | 40.6 kB | 60 kB | 40.4 kB | 60 kB | ~68% | Business journal screen |
| SupportPlanGuidePage | 12.4 kB | 40 kB | 12.4 kB | 40 kB | ~31% | Support plan guide screen |

## References

- `scripts/assert-chunk-size.mjs`
- `scripts/check-bundle.mjs`
- `vite.config.ts`
- `npm run build:ci`
- Issue #2115
- Issue #2116
