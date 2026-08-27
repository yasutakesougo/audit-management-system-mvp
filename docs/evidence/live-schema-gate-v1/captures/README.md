# Live inventory captures

GET-only dumps from PnP / REST / Graph / browser console belong here.

They are gitignored so site field inventories are not committed by accident.
Classify with:

```bash
node scripts/ops/live-schema-gate-inventory.mjs --mode file --input ./dump.json
```

HOLD evidence (UNVERIFIED, no live dump) lives in the parent folder: `HOLD_REPORT.md`.
