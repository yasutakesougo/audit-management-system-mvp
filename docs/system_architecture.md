# System Architecture — Evidence-Driven Care Improvement OS

> **Last Updated**: 2026-03-12
> **Version**: Phase 6 Complete

---

## Overview

This system is not a record-keeping application.
It is an **Evidence-Driven Care Improvement Operating System**.

```
Evidence Layer → Analysis Layer → Decision Layer → Trace Layer
```

Every piece of data recorded in this system flows through a
**structured meaning-transformation pipeline** that converts
raw observations into actionable, auditable care improvements.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Evidence Layer                     │
│                                                     │
│  Today ─→ Schedules ─→ Daily Record                 │
│                          │                          │
│                          ▼                          │
│  ┌──────────────────────────────────────────────┐   │
│  │              Analysis Layer                   │   │
│  │                                              │   │
│  │  Iceberg Canvas                              │   │
│  │  ├── Behavior nodes                          │   │
│  │  ├── Environment nodes                       │   │
│  │  ├── Hypothesis links                        │   │
│  │  └── Snapshot persistence                    │   │
│  │         │                                    │   │
│  │         ▼                                    │   │
│  │  PDCA Cycle                                  │   │
│  │  ├── PLAN → DO → CHECK → ACT                │   │
│  │  └── ACT items ──────────────────────┐       │   │
│  └──────────────────────────────────────┤───────┘   │
│                                         │           │
│  ┌──────────────────────────────────────▼───────┐   │
│  │             Decision Layer                    │   │
│  │                                              │   │
│  │  generateIcebergProposals()                  │   │
│  │         │                                    │   │
│  │         ▼                                    │   │
│  │  SupportChangeProposal                       │   │
│  │  ├── proposed ──→ [採用/保留/却下]            │   │
│  │  ├── accepted  (irreversible)                │   │
│  │  ├── deferred  (re-reviewable)               │   │
│  │  └── rejected  (irreversible)                │   │
│  │         │                                    │   │
│  │         ▼                                    │   │
│  │  buildReflectionTraces()                     │   │
│  │         │                                    │   │
│  │         ▼                                    │   │
│  │  PlanReflectionTrace                         │   │
│  │  └── monitoringPlan                          │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  Monitoring ←─────── 再分析 ───────→ Iceberg        │
│  (循環構造)                                          │
└─────────────────────────────────────────────────────┘
```

---

## Evidence Pipeline

The core of this system is a **meaning-transformation pipeline**:

| Stage | Input | Output | Transformation |
|-------|-------|--------|----------------|
| Record | User action | Daily Record | **observation → text** |
| Analyze | Daily records | Iceberg hypothesis | **text → structure** |
| Improve | Hypothesis | PDCA ACT item | **structure → action** |
| Propose | ACT item | Proposal | **action → decision input** |
| Decide | Proposal | accepted/rejected | **input → decision** |
| Trace | Decision | Reflection trace | **decision → audit trail** |

Each transformation is:
- **Typed** — TypeScript interfaces connect each stage
- **Tested** — Pure functions with unit tests
- **Independent** — Each stage works without the others
- **Auditable** — Every step is traceable

---

## Type Flow

```typescript
// Stage 1: Record
DailyRecord

// Stage 2-3: Analyze → Improve
IcebergNode → IcebergPdcaItem (phase: 'ACT')

// Stage 4: Propose
generateIcebergProposals({ userId, items })
  → SupportChangeProposal (status: 'proposed')

// Stage 5: Decide
transition('proposed', 'accepted')
  → SupportChangeProposal (status: 'accepted')

// Stage 6: Trace
buildReflectionTraces(proposals)
  → PlanReflectionTrace
```

**Compiler-enforced connections** — if a type changes,
all downstream stages produce compile errors.

---

## State Machine

```
           ┌─── accepted (terminal)
           │
proposed ──┼─── deferred ──┬── proposed (re-review)
           │               ├── accepted (terminal)
           └─── rejected   └── rejected (terminal)
                (terminal)
```

**Design principle**: Terminal states are irreversible.
This ensures audit trail stability.

---

## Module Map

```
src/
  features/
    dashboard/          ← Today hub
    schedules/          ← Schedule management
    daily-records/      ← Daily observations
    ibd/analysis/
      iceberg/          ← Canvas + Store
      pdca/             ← PDCA cycle + Evidence adapter
    ibd/plans/
      support-plan/     ← Deadline logic
    support-plan-guide/ ← Monitoring + Proposals
      domain/
        proposalTypes.ts
        proposalGenerator.ts
        proposalStateMachine.ts
        planReflectionTrace.ts
      components/
        ProposalReviewSection.tsx
        ReflectionTraceSection.tsx
        tabs/MonitoringTab.tsx
```

---

## Backbone Navigation

```
Today → Schedules → Daily → Iceberg → Monitoring
                                          ↑
                                       再分析
```

The **circular link** (Monitoring → Iceberg re-analysis)
ensures continuous improvement is structurally guaranteed.

---

## Design Principles

### 1. Evidence-Driven
Every decision must trace back to evidence.

### 2. Type-Safe Pipeline
TypeScript types enforce pipeline connections at compile time.

### 3. Irreversible Decisions
Accepted and rejected proposals cannot be modified (audit stability).

### 4. Domain-First
Domain logic (types, generators, state machine) is implemented
and tested before any UI components.

### 5. Adapter Evolution
New output formats are added alongside existing ones,
never replacing them (Open-Closed Principle).

### 6. Circular by Design
The system forms a loop, not a line.
Improvement cycles are structurally enforced.

---

## Test Coverage Summary

| Domain | Tests |
|--------|-------|
| Proposal Generator | 7 |
| State Machine | 15 |
| Reflection Trace | 5 |
| Iceberg Store CRUD | 8 |
| **Total (Phase 5-6)** | **53+** |
