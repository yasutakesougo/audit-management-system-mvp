# Architectural Data Contract Rules

This document defines the strict architectural contracts of the Audit Management System to prevent regressions and maintain the "Contract-Synchronized" state.

## 1. Nullability Contract
To maintain consistency between SharePoint and Domain models, we follow a "missing-is-undefined" policy.

| State | value | Rationale |
|---|---|---|
| Optional / Missing | `undefined` | Standard for optional fields in TypeScript and JS. |
| Explicit Absence | `null` | Reserved for explicitly meaningful nulls (e.g., clearing a field). Use sparingly. |
| Boolean Absence | `false` | Fall-open/Default-false for flags. |

**Rule:** Adapters and Mappers MUST return `undefined` for optional SharePoint fields that are missing or null in the payload.

---

## 2. Field Naming & SSOT (Single Source of Truth)
We use a layered priority to resolve physical SharePoint column names.

### Priority Order:
1. `spListRegistry.ts` (List existence & Base structure)
2. `src/sharepoint/fields/*.ts` (Field candidates & Essentials)
3. Adapter layer (Converts SP raw row $\rightarrow$ Domain)
4. Repository / Provider (Data access)
5. Tests (Verification)

### Naming Convention:
- **Canonical (JS/TS):** Always use `camelCase` (e.g., `userId`, `recordDate`).
- **SharePoint Internal:** Handled via `CANDIDATES` arrays in `fields/*.ts`.
- **Constraint:** Internal names exceeding 32 characters in SharePoint are handled via Strategy E (32-char prefix matching) in `sp/helpers.ts`.

---

## 3. Repository & Provider (DI Contract)
The `IDataProvider` interface is the boundary between business logic and the infrastructure.

- **Self-Healing:** All Providers must support `ensureListExists`.
- **Resolution:** Components and hooks must use `Dynamic Schema Resolution` to support "Drift Resistance" (handling SharePoint column renames without code changes).

---

## 4. Testing Principles
- **Aesthetics & UI:** Avoid generic text matches. Use specific selectors or `within()` to scope checks.
- **Drift Tests:** Every new split-list or field set must include a `.drift.spec.ts` test to verify resolution against candidate variations.
- **Fail-Open:** Tests should verify that the system remains usable even when non-essential fields are missing.

---

## 5. Maintenance Guardrails
❌ DO NOT use hardcoded field strings in Repositories; use mappers/adapters.
❌ DO NOT return `null` from adapters for optional fields.
❌ DO NOT modify `CANDIDATES` without updating the corresponding `.drift.spec.ts`.
