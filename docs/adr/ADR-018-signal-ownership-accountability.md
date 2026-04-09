# ADR-018: Signal Ownership & Operational Accountability

## Status
Accepted

## Context
Following the implementation of Role-Based Visibility (`ADR-017`), signals are successfully filtered by authority. However, to prevent the "Bystander Effect"—where multiple authorized users see a signal but none take action—we must define clear "Ownership" for every alert in the Today Action Center.

## Decision
We introduce the concept of "Signal Ownership" to mandate accountability and move from passive notification to active task assignment.

### 1. Ownership Categories
Each signal in the Exception Center MUST carry an `ownerRole` and an optional `assigneeId`.

| signal Group | Owner Role | Assignment Logic |
| :--- | :--- | :--- |
| **FOUNDATION** | `Admin` | **Broadcast (Shared Role Liability)**. All admins are responsible for infrastructure health. |
| **SAFETY** | `Manager` / `Staff (Shift Lead)` | **Regional/Shift Assignment**. The person currently on duty for the facility. |
| **OPERATIONAL** | `Staff` | **Individual Assignment**. The specific user responsible for the target client/task. |

### 2. Signal Contract Extension
The `ExceptionItem` and `TodayExceptionAction` types will be extended to include ownership metadata:

```typescript
export type TodayExceptionAction = {
  // ... existing fields
  ownerRole: 'admin' | 'manager' | 'staff'; // Mandatory
  assigneeId?: string; // Optional: direct assignment
};
```

### 3. Accountability Principles
- **Sole Source of Truth**: Today Action Center is the primary arbiter of "What must I do now?".
- **Zero-Bystander Rule**: Operational signals (Priority 2+) should ideally be mapped to a specific `assigneeId` based on the user's shift or client assignment.
- **Escalation**: If an `OWNER` does not resolve a signal within its TTL (as defined in ADR-016), the signal's priority may be escalated or broadcast to higher `ownerRole` groups.

## Consequences
- **Positive**: Eliminates ambiguity in "whose job it is" to fix a setup error or missing record.
- **Positive**: Enables personal task tracking and performance metrics for staff.
- **Negative**: Requires a reliable mapping of users to clients/shifts (Schedule integration) to populate `assigneeId` effectively.
