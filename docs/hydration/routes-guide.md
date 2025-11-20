# Hydration Routes Configuration

## Overview

This module provides route-to-hydration mapping for performance monitoring. Each route is assigned a unique hydration entry with performance budget and tracking metadata.

## Key Components

### HydrationRouteEntry

```typescript
type HydrationRouteEntry = {
  id: HydrationSpan['id'];
  label: HydrationSpan['label'];
  budget: number; // Performance budget in ms
};
```

### HYDRATION_KEYS

Central registry of all hydration entries with type safety:

```typescript
export const HYDRATION_KEYS = {
  dashboard: { id: 'route:dashboard', label: 'Dashboard', budget: 80 },
  // ...
} as const satisfies Record<string, HydrationRouteEntry>;
```

**Key Benefits:**

- `as const` preserves literal types for autocomplete
- `satisfies` ensures structure compliance without widening types
- Prevents typos and missing properties

## Route Matching

Routes are matched by `MATCHERS` array in order of priority:

```typescript
const MATCHERS: Matcher[] = [
  // Query-specific matches first (highest priority)
  {
    match: (path, search) => path.startsWith('/schedules') && includesQuery(search, 'view', 'day'),
    entry: HYDRATION_KEYS.schedulesDay,
  },

  // Specific path matches
  { match: (path) => path.startsWith('/schedules/month'), entry: HYDRATION_KEYS.schedulesMonth },

  // General path matches (lowest priority)
  { match: (path) => path.startsWith('/schedules'), entry: HYDRATION_KEYS.schedulesWeek },
];
```

### Matching Rules

1. **Query Parameters**: `?view=day` takes precedence over path-only matching
2. **Specificity**: More specific paths match before general ones
3. **Case Insensitive**: All paths normalized to lowercase
4. **Slash Handling**: Trailing slashes removed, leading slashes ensured

## Performance Budgets

Budget guidelines by page complexity:

- **Simple pages (80-90ms)**: Dashboard, basic lists
- **Medium complexity (110-120ms)**: Forms, filtered views
- **Complex pages (150-160ms)**: Calendar views, heavy data processing

```typescript
const budgetExamples = {
  dashboard: 80,      // Simple overview
  dailyActivity: 110, // Form with data
  schedulesMonth: 160 // Complex calendar
};
```

## Usage Examples

### Basic Resolution

```typescript
import { resolveHydrationEntry } from '@/hydration/routes';

// Simple path matching
const entry = resolveHydrationEntry('/audit');
// Returns: { id: 'route:audit', label: 'Audit', budget: 90 }

// Query parameter matching
const dayView = resolveHydrationEntry('/schedules', '?view=day');
// Returns: { id: 'route:schedules:day', label: 'Schedules Day', budget: 120 }
```

### Type-Safe Route IDs

```typescript
import type { HydrationRouteId } from '@/hydration/routes';

// Union type of all valid route IDs
const validIds: HydrationRouteId[] = [
  'route:dashboard',
  'route:audit',
  'route:schedules:week'
];
```

### Development Helpers

```typescript
import { getUnmatchedHydrationKeys } from '@/hydration/routes';

// Find entries without matchers (useful for debugging)
const orphaned = getUnmatchedHydrationKeys();
console.log('Routes needing matchers:', orphaned);
```

## Adding New Routes

### Step 1: Add to HYDRATION_KEYS

```typescript
export const HYDRATION_KEYS = {
  // ... existing entries
  myNewPage: {
    id: 'route:my-new-page',
    label: 'My New Page',
    budget: 100
  },
} as const satisfies Record<string, HydrationRouteEntry>;
```

### Step 2: Add Matcher

```typescript
const MATCHERS: Matcher[] = [
  // ... existing matchers
  { match: (path) => path.startsWith('/my-new-page'), entry: HYDRATION_KEYS.myNewPage },
];
```

### Step 3: Verify Coverage

```typescript
// Should return empty array or exclude your new entry
getUnmatchedHydrationKeys();
```

## Best Practices

### Naming Conventions

- **IDs**: `route:feature` or `route:feature:subpage`
- **Labels**: Human-readable, sentence case
- **Keys**: camelCase matching feature names

### Matcher Priority

1. Most specific query combinations first
2. Specific paths before general ones
3. Exact matches before `startsWith`
4. Fallback matchers last

### Budget Guidelines

- Start with reasonable estimates based on page complexity
- Monitor actual performance via hydration HUD
- Adjust budgets based on real-world data
- Consider mobile performance (lower budgets)

## Testing

Comprehensive test coverage ensures:

- All routes resolve correctly
- Path normalization works
- Query parameter matching
- Budget reasonableness
- No duplicate IDs
- Consistent naming patterns

```bash
npm test src/hydration/__tests__/routes.spec.ts
```

## Debugging

### Common Issues

1. **Route not tracked**: Check if entry exists in HYDRATION_KEYS and has matching MATCHER
2. **Wrong entry matched**: Verify MATCHERS order - more specific should come first
3. **Performance issues**: Check if budget is appropriate for page complexity

### Debug Tools

```typescript
// Check what entry a path resolves to
console.log('Resolved:', resolveHydrationEntry('/your/path'));

// Find unmatched entries
console.log('Unmatched:', getUnmatchedHydrationKeys());

// Verify all entries are used
const allKeys = Object.keys(HYDRATION_KEYS);
const unmatchedKeys = getUnmatchedHydrationKeys();
console.log('Coverage:', ((allKeys.length - unmatchedKeys.length) / allKeys.length * 100).toFixed(1) + '%');
```

## Migration Notes

### Feature-level spans

Route hydration spans live in `HYDRATION_KEYS` while heavy sub-flows now use `HYDRATION_FEATURES` (`src/hydration/features.ts`).
Use `startFeatureSpan(HYDRATION_FEATURES.someEntry, meta)` when instrumenting manual spans so budgets stay in sync with the docs generator.

### Legacy /schedule vs /schedules

Both patterns are supported during migration period. Remove the legacy matcher once migration is complete.
