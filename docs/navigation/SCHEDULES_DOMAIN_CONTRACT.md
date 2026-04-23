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
- **Current**: `/schedules/week`
- **Future**: `/schedules/calendar/week`
- **Focus**: Team-wide situational awareness.

### 👥 Assignment Domain (采配系)
- **Current**: `/transport/assignments`
- **Future**: `/schedules/assignment/transport`
- **Focus**: Resolving coordination conflicts and allocating personnel/vehicles.

### 🛡️ Resource Domain (資源系)
- **Current**: `/admin/integrated-resource-calendar`
- **Future**: `/schedules/resource/integrated-calendar`
- **Focus**: Managing physical infrastructure and asset availability (Admin only).

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
