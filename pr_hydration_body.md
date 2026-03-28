## Overview
This PR represents the first stage of Phase 3-B: Initial Hydration Extraction. It securely extracts the synchronous calculation of the Form's default values out of the ViewModels, setting the stage for future asynchronous remote event fetching. This is stacked onto PR #1329 (`refactor/schedules-pr-3-a-action-orchestrator`).

### Key Changes
* **Initial Hydration Orchestrator**: Introduces `useScheduleHydrationOrchestrator` to strictly isolate `mode === 'edit'` divergence, `initialOverride` merge resolution, `buildAutoTitle` execution, and `createInitialScheduleFormState` orchestration map.
* **ViewModel Purification**: Removes all default value calculations from `useScheduleCreateForm`, mutating it to cleanly accept `initialFormState` directly.
* **UI Thinning Continuation**: Refactors `ScheduleCreateDialog` to directly wire outputs from the Hydration Orchestrator into the inputs of the abstract Form ViewModel hook.

### Validation
* `npx tsc --noEmit` is cleanly passing.
* `npx vitest run src/features/schedules` is completely green.
