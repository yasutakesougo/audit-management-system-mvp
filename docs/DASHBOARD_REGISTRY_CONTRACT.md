# Dashboard Section Registry Contract

## Type-Safe Section Registry (網羅性保証)

### Registry Pattern

```typescript
// src/features/dashboard/sections/registry.tsx

type SectionRegistry = {
  [K in DashboardSectionKey]: SectionComponent<K>;
};

export const SECTION_REGISTRY = {
  safety: SafetySection,
  attendance: AttendanceSection,
  daily: DailySection,
  schedule: ScheduleSection,
  handover: HandoverSection,
  stats: StatsSection,
  adminOnly: AdminOnlySection,
  staffOnly: StaffOnlySection,
} as const satisfies SectionRegistry;
```

### Contract Enforcement

✅ **網羅性チェック**: `DashboardSectionKey` に新しいキーを追加したら、`SECTION_REGISTRY` に対応するコンポーネントを追加しない限りコンパイルエラー

✅ **型安全な Props**: 各セクションキーに対応する正しい props 型が自動的に推論される

✅ **Import 経路統一**: Registry は `impl/index.ts` からのみ import（公開 API として固定）

## E2E Contract: Section-Level Testids

### Testid Hierarchy

```
dashboard-page (Page-level)
└── dashboard-section-${key} (Section-level) ← NEW
    └── dashboard-${feature}-* (Feature-level)
```

### Section Testids (All 8 Sections)

| Section Key    | Testid                            | Component                |
| -------------- | --------------------------------- | ------------------------ |
| `safety`       | `dashboard-section-safety`        | SafetySection (Box)      |
| `attendance`   | `dashboard-section-attendance`    | AttendanceSection (Paper)|
| `daily`        | `dashboard-section-daily`         | DailySection (Paper)     |
| `schedule`     | `dashboard-section-schedule`      | ScheduleSection (Paper)  |
| `handover`     | `dashboard-section-handover`      | HandoverSection (Box)    |
| `stats`        | `dashboard-section-stats`         | StatsSection (Stack)     |
| `adminOnly`    | `dashboard-section-adminOnly`     | AdminOnlySection (Box)   |
| `staffOnly`    | `dashboard-section-staffOnly`     | StaffOnlySection (Stack) |

### E2E Usage Example

```typescript
// Stable selector pattern (DOM structure changes don't break tests)
await page.locator('[data-testid="dashboard-section-handover"]').waitFor();
await expect(page.locator('[data-testid="dashboard-section-stats"]')).toBeVisible();
```

## Benefits

### 1) 型安全性 (Type Safety)
- 新しいセクション追加時にコンパイル時エラーで検出
- props 型のミスマッチを自動検出

### 2) 保守性 (Maintainability)
- switch 文撲滅 → key/component の手動同期不要
- DashboardPage の依存配列を 24 → 3 に削減
- ファイルサイズ: 1,283 → 1,050 行 (-18%)

### 3) テスト安定性 (Test Stability)
- Section-level testids で DOM 変更に強い
- Registry 網羅性テストで key カバレッジを保証可能

## Contract Evolution (Future)

### Phase 2: Layout Extraction
- Zone-level testids: `dashboard-zone-briefing`, `dashboard-zone-today`, `dashboard-zone-work`
- `DashboardLayout` コンポーネントに Zone 分岐を移動

### Phase 3: Summary Hook
- `useDashboardSummary()` hook で計算ロジックを集約
- Section props 生成を hook に移動

---

**Status**: ✅ Implemented (Phase 1 - Registry Pattern)  
**Next**: Layout extraction (Phase 2)
