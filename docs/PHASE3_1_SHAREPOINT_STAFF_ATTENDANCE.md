# Phase 3.1 SharePoint Staff Attendance Design

## Goal

Replace Phase 2 localStorage persistence with SharePoint-backed persistence for staff attendance:
- Single source of truth (SharePoint list)
- Multi-device access (same data across PCs/tablets)
- Conflict-safe updates (etag)
- Offline-friendly (Phase 3.1 baseline: minimal, Phase 3.2 expands)

---

## 1) SharePoint List Design

### List

- Name: `StaffAttendance`

### Columns

| Column | Type | Required | Notes |
|---|---|---:|---|
| Title | Single line text | Yes | Use as `Key` (see below). Keep it deterministic. |
| StaffId | Single line text | Yes | ex: `STF-100` |
| RecordDate | Date and Time | Yes | store date-only (00:00:00). |
| Status | Choice | Yes | `出勤`, `欠勤`, `外出中` (extend later) |
| CheckInAt | Date and Time | No | optional |
| CheckOutAt | Date and Time | No | optional |
| LateMinutes | Number | No | optional |
| Note | Multiple lines of text | No | optional |
| Modified | (system) | - | server truth |
| Editor | (system) | - | auditing |

### Key Strategy (Uniqueness)

SharePoint does not reliably enforce composite unique constraints.
We enforce uniqueness via a deterministic single key:

- **Key format**: `YYYY-MM-DD#STAFF_ID`
- **Stored in**: `Title` (or a dedicated `Key` column if preferred)

Example:
- `2026-01-31#STF-100`

Rules:
- One staff has exactly one record per day.
- Upsert always targets by Key.

---

## 2) Domain Model (App)

### Existing domain type (Phase 2)

```typescript
type StaffAttendance = {
  staffId: string;
  recordDate: string; // YYYY-MM-DD
  status: '出勤' | '欠勤' | '外出中';
  checkInAt?: string;
  checkOutAt?: string;
  lateMinutes?: number;
  note?: string;
};
```

### Normalization

- `recordDate` is `YYYY-MM-DD` in app
- On SharePoint save: convert to ISO date at local midnight (or UTC-normalized) consistently.
- **Do not** compute "today" inside store/adapter (test stability).

**Decision**: RecordDate handling
- ✅ Use **Date-only** (no time component) on SharePoint
- Convert at app boundary: `new Date(recordDate).toISOString().slice(0, 10)`

---

## 3) API Boundary: Port + Adapter

### Error Types

```typescript
export type StaffAttendanceError =
  | { kind: 'NetworkError'; message: string }
  | { kind: 'AuthError'; message: string }
  | { kind: 'ConflictError'; message: string } // etag mismatch
  | { kind: 'ValidationError'; message: string };

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: StaffAttendanceError };
```

### Port Interface

```typescript
export interface StaffAttendancePort {
  upsert(a: StaffAttendance): Promise<Result<void>>;
  remove(key: string): Promise<Result<void>>;
  getByKey(key: string): Promise<Result<StaffAttendance | null>>;
  listByDate(recordDate: string): Promise<Result<StaffAttendance[]>>;
  countByDate(recordDate: string): Promise<Result<StaffAttendanceCounts>>;
}

export type StaffAttendanceCounts = {
  onDuty: number;
  out: number;
  absent: number;
  total: number;
};
```

### Key Builder (Single Truth)

```typescript
export function buildAttendanceKey(recordDate: string, staffId: string): string {
  return `${recordDate}#${staffId}`;
}
```

---

## 4) SharePoint Adapter Behavior

### Upsert Algorithm (Key-based)

1. Compute key = `YYYY-MM-DD#STAFF_ID`
2. Query by `Title == key` (REST: `$filter=Title eq '${key}'`)
3. If not found: Create new item
4. If found: Update using etag (optimistic concurrency)
   - Include `If-Match: "${etag}"` header
   - If mismatch (409 Conflict): return `ConflictError`

### Conflict Strategy (Phase 3.1 baseline)

- If etag mismatch: return `ConflictError`
- UI can show: "他の端末で更新されました。再読み込みしてください。"
- (Phase 3.2 can add merge UI / last-write-wins)

### REST Endpoints Used

- `GET /sites/{site}/lists/StaffAttendance/items?$filter=Title eq '${key}'`
- `POST /sites/{site}/lists/StaffAttendance/items`
- `PATCH /sites/{site}/lists/StaffAttendance/items/{itemId}`
- `DELETE /sites/{site}/lists/StaffAttendance/items/{itemId}`

---

## 5) Sync / Offline Strategy

### Phase 3.1 Baseline

- **Online-first**: Save directly to SharePoint
- **If offline/network failure**: show error + keep local state
- **No background queue yet** (Phase 3.2)

### Phase 3.2 (Planned)

- **Hybrid adapter**: local queue + retry
- **Reconcile on reconnect**
- localStorage as fallback cache

---

## 6) Migration Plan (Step-by-step)

### 3.1-A: Port + Local Adapter

- Wrap existing in-memory/localStorage behavior behind `StaffAttendancePort`
- No behavioral change yet

### 3.1-B: SharePoint Adapter

- Implement SharePoint CRUD + etag handling
- Manual testing only (feature flag OFF)

### 3.1-C: Toggle by Feature Flag

- Feature flag to switch persistence source safely
- Environment: `VITE_USE_SHAREPOINT_STAFF_ATTENDANCE` (default: false)

### 3.1-D: Validation + Telemetry

- Basic validation errors surfaced (e.g., invalid status)
- Log key events (save ok/fail/conflict)

---

## 7) Done Criteria

- [x] List schema approved (this doc)
- [ ] Port interface defined + merged
- [ ] Local adapter wrapped + tests pass
- [ ] SharePoint adapter implemented (feature-flag OFF)
- [ ] Feature flag path exists in config
- [ ] Minimal manual test: create/update/read for same staff/day
- [ ] CI all green

---

## 8) Risks & Mitigations

| Risk | Mitigation |
|---|---|
| etag conflicts in multi-user | Pessimistic UI: show "refresh" button instead of auto-retry |
| RecordDate timezone drift | Always store as local date-only (no time), validate at boundary |
| Network timeout | Short timeout (5s), fail fast, show error message |
| SharePoint list not initialized | Provision script includes list creation |
| Missing Choice values | Validate status against allowed list before save |

---

## 9) Next Phase (3.2)

- Background queue for offline-first flow
- Conflict resolution UI (merge / last-write-wins)
- Cross-device sync notification
- localStorage capacity management

---

## References

- Phase 2 Completion: `docs/PHASE2_COMPLETION.md`
- SharePoint REST API: Microsoft Graph / SharePoint REST docs
- Feature Flags: `src/config/featureFlags.ts`
