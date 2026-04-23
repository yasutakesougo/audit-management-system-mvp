# Schedules Domain Contract (IA & Responsibility Map)

This document defines the strategic boundaries, visibility rules, and future navigation structure for the **Schedules Hub**.

## 1. Responsibility Boundary

| Hub | Layer | Primary Objective | Key Actions |
| :--- | :--- | :--- | :--- |
| **Today** | **Execution** | Real-time performance | Check-in, Recording, Immediate feedback |
| **Schedules** | **Coordination** | Planning & Allocation | Staff assignment, Vehicle allocation, Resource booking |

### Case Study: Transport (送迎)
- **Today Hub**: `送迎実施` (Performing the transport, vital sign entry at pickup).
- **Schedules Hub**: `送迎配車調整` (Planning the routes, assigning drivers and vehicles).

---

## 2. Future Route Map (Phased Migration)

To maintain stability, current URLs are preserved, but internal constants and future implementations will follow this taxonomy:

### 📅 Calendar Domain (閲覧系)
- **Primary Objective**: Team-wide situational awareness and schedule visibility.
- **Current**: `/schedules/week` (`週間予定`)
- **Future**: `/schedules/calendar/week`
- **Example**: "What is the team's workload for next Tuesday?" (Awareness)

### 👥 Assignment Domain (采配系)
- **Primary Objective**: Optimizing resource allocation and resolving conflicts before execution.
- **Current (Representative)**: `/transport/assignments` (`送迎配車調整`)
- **Future Taxonomy**:
  - `/schedules/assignment/transport`: Vehicle and driver allocation.
  - `/schedules/assignment/support`: Matching users with support sessions/staff.
  - `/schedules/assignment/staff`: Daily task distribution and shift coordination.
  - `/schedules/assignment/resource`: Resolving room/equipment booking conflicts.
- **Responsibility vs. Today Hub**:
  - **Schedules**: "Who is assigned to this vehicle for tomorrow's route?" (Coordination)
  - **Today**: "I am starting the transport route now." (Execution)
- **Migration Note**: `transport` is the lead domain for the assignment-centric structure. Existing logic is being stabilized here before expanding to staff/support assignment.

### 🛡️ Resource Domain (資源系)
- **Primary Objective**: Managing the master availability and "inventory" of assets.
- **Current**: `/admin/integrated-resource-calendar` (`リソースカレンダー`)
- **Future**: `/schedules/resource/integrated-calendar`
- **Example**: "Is Room A available for a recurring meeting?" (Asset Management)

---

## 3. Visibility & Authorization Matrix

| Domain | Staff (Standard) | Admin (Standard) | Field Staff Shell |
| :--- | :---: | :---: | :---: |
| **Calendar** | ✅ (Read/Write) | ✅ (Full) | ✅ (Read-only focus) |
| **Assignment** | ✅ (Coordination) | ✅ (Full) | ❌ (Filtered) |
| **Resource** | ❌ (Limited) | ✅ (Full) | ❌ (Hidden) |

---

## 4. Design Principles for Developers

1. **Don't Fatten `navigationConfig.ts`**: All domain-specific visibility logic must reside in `routeGroups/schedulesRoutes.ts`.
2. **Preserve Current URLs**: Do not change `to: string` paths until a full redirect strategy is in place.
3. **Shell-Aware factories**: Always use the `(isFieldStaffShell: boolean) => NavItem` pattern to allow dynamic filtering based on the operational context.
