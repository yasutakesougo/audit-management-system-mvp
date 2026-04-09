# ADR-016: Proactive Setup Guidance Signals (setup-incomplete)

## Status
Accepted

## Context
As the system evolves from a simple recording tool to an Operational Support OS, we encounter scenarios where "no data" or "empty states" are caused by missing configuration rather than technical errors or lack of staff activity. 
In the Analysis Workspace, the absence of "Analysis Targets" (IsSupportProcedureTarget = true) led to a passive, broken-looking UI.

We need a proactive way to detect these "configuration gaps" and lead the user to resolution before they encounter a dead-end UI.

## Decision
We introduce a new exception category `setup-incomplete` to the `Today` Action Center (Signal layer).

### 1. Category Definition: `setup-incomplete`
- **Definition**: Missing prerequisite configuration required for a specific business feature to function.
- **Icon**: ⚙️ (Gear)
- **Role**: Guidance-first. It is not an error (system failure) nor a violation (staff missed a task), but a "Readiness Gap".

### 2. Severity and Priority
- **Severity**: `high` by default. It is "High priority" because it blocks an entire feature, but not `critical` (which is reserved for immediate safety or legal risks).
- **Today Priority**: `0` (Highest). In `buildTodayExceptions`, `setup-incomplete` is ranked above `critical-handoff` to ensure the "foundations" are addressed first.

### 3. Trigger Conditions (Readiness Verification)
To prevent false alarms and ensure diagnostic integrity:
- **Feature Activation**: The primary feature (e.g., Analysis) must be enabled in settings.
- **Zero-State Check**: Required configuration count MUST be exactly `0`. (Partial setup is handled via `violation` or `warning`).
- **Data Integrity**: Repository fetch must be successful. If there is a system error (Data OS alert), that takes precedence over `setup-incomplete`.

### 4. Signal Lifetime (TTL) and Re-evaluation
- **Persistence**: Signals remain visible until the "Zero-State" condition is resolved.
- **Refresh Cycle**: Re-evaluated on:
    - Initial page load.
    - Post-completion of a related action (triggering a refetch).
    - Periodic background refresh (Nightly Patrol integration).

### 5. Display Rules (Notification Fatigue Mitigation)
- **Quota**: Maximum **1–2** `setup-incomplete` signals may be displayed simultaneously. 
- **Priority**: Earlier "Foundational" gaps take priority over downstream feature gaps.
- **Audience**: Visibility is restricted to roles with configuration authority (Manager/Admin).

### 6. Dual-Action Interface
Alerts of this category SHOULD provide two navigation paths:
1. **Primary Action (`actionPath`)**: The direct resolution path (e.g., User Master to set flags).
2. **Secondary Action (`secondaryActionPath`)**: The feature dashboard or destination to verify the set-up.

### 7. Suppression and Visibility Rules
- **Environment Awareness**: Signals are suppressed in `demo=1` mode to prevent interference with synthetic data testing.
- **Global Suppression**: High-level "Feature Disable" flags suppress these signals globally if the module is not in use.

## Consequences
- **Positive**: Reduces "bystander effect" and support inquiries by providing self-service diagnostics.
- **Positive**: Standardizes how we handle "Prerequisite Gaps" across the entire OS (e.g., missing vital config, missing schedules).
- **Negative**: Risk of "Notification Fatigue" if too many setup items are flagged at once. We should limit these to high-impact "Zero State" blockers.
