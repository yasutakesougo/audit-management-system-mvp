# Live inventory captures

Read-only dumps from REST / Graph / browser console (HTTP GET-ONLY) and PnP
(READ-ONLY; transport method not guaranteed) belong here.

They are gitignored so site field inventories are not committed by accident.
Classify with:

```bash
node scripts/ops/live-schema-gate-inventory.mjs --mode file --input ./dump.json
```

HOLD evidence (UNVERIFIED, no live dump) lives in the parent folder: `HOLD_REPORT.md`.
