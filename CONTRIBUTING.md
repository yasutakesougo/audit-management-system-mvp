# Contributing

Thanks for taking the time to contribute! Please follow the guidelines below to help keep the project healthy.

## Preflight before PR

Run the full safety net locally before opening a Pull Request:

```bash
npm run preflight
```

The CI pipeline runs `npm run preflight:ci`, which covers type checking, linting, Users-focused unit tests, and the Users Playwright E2E suite. If a job fails, review the corresponding logs (and any generated Playwright trace/video artifacts), address the issue, and re-run the command locally before pushing new commits.

## Nurse medication layout updates

- When touching the nurse medication layout (`src/features/nurse/medication/MedicationRound.tsx`), refresh the visual baselines locally:

  ```bash
  VITE_SKIP_LOGIN=1 npx playwright test tests/e2e/nurse.med.visual.spec.ts --update-snapshots
  ```

- Commit the updated assets under `tests/e2e/__screenshots__/nurse.med.visual.spec.ts/`.
- The spec relies on `TESTIDS.NURSE_MEDS_GRID_SUMMARY` and `TESTIDS.NURSE_MEDS_GRID_CONTROLS`; keep these identifiers intact when editing the markup.
- Ensure the nurse workspace flags remain enabled by setting `VITE_FEATURE_NURSE=1` (CI uses the same env alongside `VITE_SKIP_LOGIN=1`).
