# Pull Request Template

## Summary
<!-- Describe the purpose and context of this change -->

## Changes
- [ ] Added: 
- [ ] Updated: 
- [ ] Fixed: 

## Review Focus (Linting \u0026 Testing)
- [ ] **Lint Relaxation**: Are any linting rule relaxations (`off`) strictly scoped to test/helper files via `overrides` in `.eslintrc.cjs`?
- [ ] **Test Intent**: Does this change preserve the original testing intent (e.g., specific mock gaps) while improving type safety?
- [ ] **No `any`**: Have `any` usages been replaced with `unknown` or specific domain types where possible?

## Validation
- [ ] `npx eslint . --ext .ts,.tsx --max-warnings=0` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes (relevant specs).

## Self-Review
- [ ] `console.log` removed from production files.
- [ ] Critical business logic separation (Domain/Repository/UI) is maintained.
- [ ] `as unknown as T` is used only for intentional mock discrepancies.
