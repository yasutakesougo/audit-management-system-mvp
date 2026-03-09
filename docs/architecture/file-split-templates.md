# File Split Templates

> Reusable modularization patterns established in Wave 2–3.
> Use these templates to split files that exceed the **600-line guardrail**.

## Decision Flowchart

```
Is the file a config/settings file?
  → Yes → Config Split
  → No  → Does the file perform I/O (API, DB, SharePoint)?
            → Yes → I/O Split
            → No  → Is it a React page/component?
                      → Yes → UI Split
                      → No  → Evaluate as Config or I/O variant
```

---

## 1. Config Split

**Use when**: A settings/config file mixes type definitions, constants, and logic functions.

**Example**: `navigationConfig.ts` (686 → 441 lines, PR #816)

### Target Structure

```
feature/
├── featureConfig.types.ts      ← Types + constants
├── featureConfig.helpers.ts    ← Pure logic functions
└── featureConfig.ts            ← Factory/builder + re-exports
```

### Extraction Order

1. **Types & Constants** → `*.types.ts`
   - Type aliases, interfaces, enums
   - Lookup tables, label maps, group orders
   - Constants that don't depend on runtime logic

2. **Helper Functions** → `*.helpers.ts`
   - Pure functions (no side effects)
   - Filter, sort, transform, validate functions
   - Functions that operate on the extracted types

3. **Main File** (slimmed)
   - Factory functions that use helpers
   - Re-exports of types, constants, and helpers

### Re-export Pattern

```typescript
// featureConfig.ts
import {
  MyType,
  MY_CONSTANT,
} from './featureConfig.types';

import { myHelper } from './featureConfig.helpers';

// Re-export public API
export { MyType, MY_CONSTANT, myHelper };
export type { MyType };  // Use `export type` for type-only exports
```

### Gotchas

- **Import/re-export conflicts**: If TypeScript complains about re-exporting
  an imported name, import to a local binding first, then re-export.
- **Circular deps**: Constants must NOT import from the main file.
  Direction: `types ← helpers ← main`.

---

## 2. I/O Split

**Use when**: A data adapter mixes type definitions, pure mappers, request helpers,
and orchestration logic.

**Example**: `sharePointAdapter.ts` (657 → 240 lines, PR #817)

### Target Structure

```
feature/data/
├── featureSpTypes.ts           ← SP item shape + field names
├── featureSpMappers.ts         ← Domain ↔ SP transformations
├── featureSpHelpers.ts         ← OData builders, request helpers
└── featureAdapter.ts           ← Port factory + re-exports
```

### Three-Layer Separation

| Layer | File | Testability | Dependencies |
|---|---|---|---|
| **Pure** | types + mappers | Unit testable, no mocks needed | None |
| **I/O** | helpers | Needs fetch mock / SP mock | Pure layer |
| **Orchestration** | adapter | Integration-level | Pure + I/O layers |

### Extraction Order

1. **Types & Mappers** → `*Mappers.ts`
   - SP list item shape interfaces
   - `mapSpItemToDomain()` / `mapDomainToSpItem()` functions
   - Field name constants
   - Date/string/ID conversion utilities

2. **Request Helpers** → `*Helpers.ts`
   - OData filter/query builders
   - `fetchRange()`, `batchCreate()` wrappers
   - Error detection and retry logic
   - Timezone/date-range helpers

3. **Adapter Shell** (slimmed)
   - `makePort()` factory function
   - High-level CRUD methods (`getAll`, `upsert`, `delete`)
   - Re-exports public API

### Dependency Direction

```
Types/Mappers ← Request Helpers ← Adapter Shell
(pure)          (I/O)              (orchestration)
```

### Gotchas

- **SP internal names**: Never rename SharePoint field references during split.
  Copy them exactly.
- **Error handling**: Keep retry/abort logic in helpers, not in mappers.
- **Re-export**: The adapter shell must re-export everything consumers
  previously imported from the original file.

---

## 3. UI Split

**Use when**: A React page component embeds mock data, helper functions, sub-components,
dialogs, or form sections inline.

**Example**: `BusinessJournalPreviewPage.tsx` (636 → 289, PR #818),
`IBDDemoPage.tsx` (609 → 218, PR #819),
`IcebergPdcaPage.tsx` (602 → 353, PR #820)

### Target Structure

```
pages/
├── feature.mock.ts             ← Mock / demo data (if applicable)
├── featureHelpers.ts           ← Types, constants, pure formatters
├── FeatureSections.tsx          ← Extracted sub-components
└── FeaturePage.tsx             ← State + composition
```

Or for feature-internal pages:

```
features/domain/module/
├── moduleHelpers.ts            ← Pure helpers and types
├── ModuleMetrics.tsx           ← Dashboard / metrics sub-component
├── ModuleFormSection.tsx       ← Form + list + dialog sub-component
└── ModulePage.tsx              ← State + routing + composition
```

### Extraction Order

1. **Types, Constants, Pure Helpers** → `*Helpers.ts`
   - Type definitions used across components
   - Color maps, label lookups, formatter functions
   - Display constants (cell sizes, icon mappings)
   - Pure computation helpers

2. **Mock/Demo Data** → `*.mock.ts` or `*.data.ts`
   - Demo user lists, sample data generators
   - Seeded random functions
   - Only extract if data is >30 lines

3. **Sub-Components** → `*Sections.tsx`
   - Dialog components
   - Card/Panel sections
   - Cell renderers
   - Each receives only the data/callbacks it needs via props
   - Define prop interfaces for each section

4. **Page Shell** (slimmed)
   - `useState` / `useEffect` / `useMemo`
   - Event handlers
   - Section composition (`<Section1 />`, `<Section2 />`, ...)
   - Routing logic

### Section Component Pattern

```tsx
// FeatureSections.tsx

interface SectionProps {
  data: SomeType;
  onAction: (id: string) => void;
}

export function SectionName({ data, onAction }: SectionProps) {
  return (
    <Card>
      <CardContent>
        {/* ... */}
      </CardContent>
    </Card>
  );
}
```

### Gotchas

- **Don't split state up**: Keep all `useState`, `useCallback`, `useEffect` in
  the page shell. Sections receive state and setters via props only.
- **Don't change test IDs**: All `data-testid` values must remain identical.
- **Print/preview specs**: If the page has print styling, verify the print output
  is pixel-identical after split.
- **Default exports**: If the page uses `export default`, keep it in the page shell.

---

## Verification Checklist (All Patterns)

After every split:

- [ ] `tsc --noEmit` passes
- [ ] `eslint --max-warnings=0` passes
- [ ] Related tests pass (unit + integration)
- [ ] Import paths are correct in all consumers
- [ ] Re-exports maintain backward compatibility
- [ ] No circular dependencies introduced
- [ ] `data-testid` values unchanged
- [ ] Commit message follows convention: `refactor(scope): description`

---

## Quick Reference: When NOT to Split

- File is **under 500 lines** → Leave it alone
- File is **500-600 lines** → Monitor, but don't force a split
- File has **high cohesion** (all functions tightly coupled) → May not benefit from split
- File is a **generated file** → Don't touch it
- File is a **test file** → Extract fixtures only if >700 lines
