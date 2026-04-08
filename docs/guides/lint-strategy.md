# Lint \u0026 Type-Safety Strategy (Lead Engineer Standard)

## Philosophy: "Strict Core, Practical Tests"

Our linting strategy prioritizes high reliability for production code while maintaining high developer velocity for testing.

### 1. Production Code (`src/`) must be STRICT
- **No `any`**: `any` is prohibited. Use `unknown` with type guards or define proper interfaces.
- **No `console`**: Debugging logs must be removed before commit. Use structured logging (`auditLog`) if persistence is required.
- **Zero Warnings**: All commits must pass `eslint . --max-warnings=0`.

### 2. Test Code (`tests/`, `**/*.spec.ts`) is PRACTICAL
Tools are configured via `.eslintrc.cjs` `overrides` to allow:
- **Controlled `any`**: When constructing complex mocks, `any` or `as unknown as T` is allowed to keep tests readable, provided it doesn't mask logic errors.
- **Diagnostic `console`**: Logging is permitted in tests to aid CI failure diagnosis.

### 3. Usage Patterns for Fixes

#### Replacing `any`
Prefer this order:
1.  **Domain Type**: `const event: AuditEvent = { ... }`
2.  **Generic Record**: `Record<string, unknown>`
3.  **Explicit Mock Casting**: `const mock = { ... } as unknown as TargetType` (Use when defining intentional partial mocks).

#### Handling ESLint Warnings
- **DO NOT** use `eslint-disable` line-by-line unless it's a truly exceptional case.
- **DO** propose repository-level rule adjustments in `.eslintrc.cjs` if a pattern is consistently used in legitimate test scenarios.

## Continuous Verification
Every PR must verify:
```bash
npx eslint . --ext .ts,.tsx --max-warnings=0
npm run typecheck
```
This ensures the "Lint Philosophy" is a living standard, not just a document.
