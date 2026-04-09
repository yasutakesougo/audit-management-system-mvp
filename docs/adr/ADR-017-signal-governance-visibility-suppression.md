# ADR-017: Signal Governance (Visibility, Suppression & Priority Groups)

## Status
Accepted

## Context
With the introduction of proactive setup signals (`ADR-016`), the Today Action Center now manages a wider range of operational signals. This increases the complexity of signal delivery and the risk of notification fatigue. We need to define "Signal Governance" to handle priority collisions and ensure that signals are only delivered to the appropriate roles.

## Decision
We formalize the Signal Governance layer with three core mechanisms: Priority Grouping, Role-Based Visibility (RBV), and Multi-Level Suppression.

### 1. Signal Priority Groups
To resolve collisions between different signal types, we define the following logical groups:

| Group | Category | Priority (Internal) | Logic |
| :--- | :--- | :--- | :--- |
| **FOUNDATION** | `setup-incomplete` | 0 | Essential prerequisites. Precedes all other signals. |
| **SAFETY** | `critical-handoff`, Life-safety alerts | 1 | Immediate risk to users. High urgency. |
| **OPERATIONAL** | `missing-record`, `attention-user` | 2+ | Normal business flow and task compliance. |

*Note: Foundation signals take priority 0 because operational or safety checks may be inaccurate or non-functional if the base configuration is incomplete.*

### 2. Role-Based Visibility (RBV)
Signals must be filtered based on the user's role and authority to act:
- **Admin / Manager**: Full visibility of `FOUNDATION` and `OPERATIONAL` (aggregate) signals.
- **Staff (Frontline)**: Visibility limited to `OPERATIONAL` signals directly assigned to them or their current shift. `FOUNDATION` signals are suppressed to reduce noise.

### 3. Multi-Level Suppression Logic
Signals and actionable tasks must support the following suppression layers:
1. **Environment Suppression**: `isDemoMode` (URL parameter `demo=1`) suppresses setup signals to allow synthetic data usage.
2. **Module-Level Suppression**: If a specific module (e.g., Transport) is disabled in the facility settings, all related signals MUST be suppressed at the source.
3. **User Suppression**: `dismiss` / `snooze` preferences (already implemented) allow for temporary user-level control.

### 4. Detection Boundaries
Exception detection logic MUST check for prerequisite "Foundation" health before firing "Operational" alerts. 
Example: Do not fire "Missing Transport Record" if `detectTransportSetupExceptions` has already identified that the transport module is not configured.

## Consequences
- **Positive**: Eliminates confusion for frontline staff by hiding alerts they cannot resolve.
- **Positive**: Prevents "Alert Storms" by prioritizing foundational configuration before operational tasks.
- **Positive**: Provides a deterministic framework for adding new modules (e.g., Vitals, Nursing) with reliable readiness checks.
- **Negative**: Increased complexity in the `useTodayExceptions` logic to handle role-based filtering and cross-category suppression.
