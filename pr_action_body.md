## Overview
This PR completes the Phase 3-A Action Orchestrator refactoring by shifting **both Save and Delete orchestration** completely out of the UI components and ViewModels. This is a stacked PR onto #1328 (`refactor/schedules-pr-3-a-save-orchestrator`).

### Key Changes
* **Action Orchestrator Extraction**: Replaces `useScheduleSaveOrchestrator` with an expanded `useScheduleActionOrchestrator` that fully owns the `.handleSave()` and `.handleDelete()` domain side effects (including API execution, A11y notifications, error handling).
* **Pure Form ViewModel**: Strips duplicate `onSubmit`, `onDelete`, `isSubmitting`, `isDeleting`, and A11y state management out of `useScheduleCreateForm`, leaving it strictly responsible for data mapping and visual states.
* **UI Thinning**: Updates `ScheduleCreateDialog` to consume the orchestrator's state and handlers, entirely removing local API invocation and loading state calculation from the visual component.

### Validation
* `npx tsc --noEmit` is green.
* `npx vitest run src/features/schedules` is green (335 tests passed).
