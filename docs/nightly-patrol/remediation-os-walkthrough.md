# SharePoint Remediation OS: Operational Walkthrough

This guide documents the "Institutionalized Reduction" pipeline established for safe, evidence-based SharePoint schema sanitization.

## 🏗️ The 4-Layer Architecture

The system operates on four distinct layers to ensure zero-risk remediation:

1.  **Audit Layer (`patrol:ledger`)**: Generates the `drift-ledger.csv/md` by correlating codebase usage (`rg`) and live data existence.
2.  **Safety Layer (`confidence`)**: Classifies fields into `high` (numbered suffixes), `medium` (standard fields), and `low` confidence.
3.  **Execution Layer (`patrol:purge`)**: Performs deletions with a mandatory "Triple Gate" (Ledger -> Live Probe -> Human Confirmation).
4.  **Audit Layer (`deletion-log.json`)**: Records every deletion with its evidentiary basis for long-term accountability.
5.  **Persistence Layer (Auto-Auth)**: Automatically refreshes the session via M365 CLI to support long-running, multi-list batches.

---

## 🚀 Standard Operating Procedure

### Phase 1: Audit (Generate Evidence)
Run the ledger builder to refresh the state of all 43 lists.
```bash
npm run patrol:ledger
```
**Artifacts Generated:**
- `docs/nightly-patrol/drift-ledger.md`: Human-readable summary of zombie candidates.
- `docs/nightly-patrol/drift-ledger.csv`: Machine-readable data for the executor.

### Phase 2: Verify (Dry-Run)
Test the deletion logic against a specific list without making changes.
```bash
npm run patrol:purge -- --list=<list_key>
```
**Safety Checks Performed:**
- Verifies `usageCount === 0`.
- Verifies `hasData === false`.
- Performs a **Live Probe** with an automatic **$select fallback** for non-filterable types (e.g., Note/Multiline).
- Checks `confidence === high`.
- **Auto-Refresh**: Automatically recovers from HTTP 401 using `m365 util accesstoken get`.

### Phase 3: Reduce (Execute Purge)
Perform the actual deletion of high-confidence zombies.
```bash
npm run patrol:purge -- --list=<list_key> --confirm
```

### Phase 4: Accountability (Review Logs)
Verify the deletions in the persistent audit trail.
```bash
cat docs/nightly-patrol/deletion-log.json
```

---

## 🛡️ Safety Constraints
- **Numbered Suffixes Only**: By default, only fields matching `/\d+$/` (e.g., `Field0`) are marked as `high` confidence.
- **Note Fields**: Multiline text fields that fail the live probe are automatically skipped.
- **Override**: Use `--force-low-confidence` only for standard fields proven to be safe via manual inspection.

---

## 📈 Current Progress (Session Summary)
- **Cumulative Purges**: 454 columns.
- **Key Lists Cleaned**: `Users_Master`, `AttendanceDaily`.
- **System Health**: 0 failures, 0 regressions.
