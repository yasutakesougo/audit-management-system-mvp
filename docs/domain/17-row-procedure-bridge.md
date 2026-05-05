# 17-row Procedure Bridge Technical Specifications

## Overview
The 17-row support procedure bridge ensures that structured support plans (L2) are accurately reflected in daily records (L3). This bridge serves as the backbone for consistency between planning and execution.

## Single Source of Truth (SSOT)
The definition of the 17 rows is managed in two primary locations:
1.  **Domain Definition**: `src/features/planning-sheet/constants/procedureRows.ts` (`PROCEDURE_ROWS`)
2.  **Document Template**: `src/features/planning-sheet/domain/dailySupportProcedure.ts` (`OFFICIAL_PROCEDURE_TEMPLATE`)

Any changes to the standard row structure (timing, default activity names) must be synchronized across these files.

## Data Flow
```mermaid
graph LR
    A[SupportPlanningSheet L2] --> B(dailyProcedureMapper)
    B --> C[DailySupportProcedureDocument L3]
    C --> D(ProcedurePanel UI)
```

1.  **L2 Planning**: Users define steps in the Planning Sheet.
2.  **Mapper**: `dailyProcedureMapper.ts` (`bridgePlanningSheetToDailyProcedures`) transforms the sheet data into the 17-row document format.
3.  **Bridge Hook**: `usePlanningSheetToProcedureBridge.ts` provides the reactive data to the UI components.
4.  **UI**: `ProcedurePanel.tsx` renders the rows.

## Mapping Strategy
The mapper uses a multi-tiered strategy to find the correct row for a planning step:

1.  **Row Number (rowNo)**: Direct match if `step.order` is between 1 and 17. (Most reliable)
2.  **Activity Name**: Partial match between `step.instruction` and `template.activity`.
3.  **Timing**: Fallback match based on `step.timing` and `template.timeLabel`.

### Legacy Text Aggregation
If no structured steps exist (`procedureSteps.length === 0`), the bridge automatically aggregates legacy text fields into key rows:
*   `supportPolicy` -> Row 5 (AM日中活動) personAction
*   `concreteApproaches` -> Row 5 (AM日中活動) supporterAction
*   `environmentalAdjustments` -> Row 10/12 (PM日中活動) condition

## E2E Testing & Stability
`ProcedurePanel.tsx` implements `data-row-no` on each row element.
*   **Purpose**: To provide stable, semantic selectors for E2E tests that do not depend on fragile text content or DOM order.
*   **Verification**: `tests/e2e/procedure-17row-bridge.spec.ts` ensures that both structured mapping and legacy aggregation work as expected.

## Implementation Details
*   **ID System**: Uses a 1-based index (base-1) for `rowNo` to align with the physical form.
*   **External Activities**: Row 16 (Preparation) and Row 17 (Activity) are treated as child rows of Row 5 (AM) or Row 10/12 (PM) depending on the configuration.
*   **Source Tracking**: Each mapped row includes a `bridgeSource` field (`sheet_structured` | `sheet_fallback_text` | `empty`) for debugging.

## Future Cleanup
The old ID system and legacy repository logic in `procedureLogic.ts` are scheduled for deprecation. New features should strictly use the 17-row model and the bridge infrastructure.

## Commands for Safety
When modifying the bridge or mapper, always run:
```bash
# Unit tests
npm test src/features/planning-sheet/logic/dailyProcedureMapper.spec.ts

# E2E tests
npx playwright test tests/e2e/procedure-17row-bridge.spec.ts
```

## Operational Observation
For real-world data validation and continuous monitoring, refer to the operational checklist:
*   [17-row Procedure Observation Checklist](../ops/17-row-procedure-observation-checklist.md)
