## Summary
- Use `DailyRecordRows` as the default SharePoint list name for execution record persistence
- Hydrate execution records from SharePoint when the time-based support record page mounts
- Keep the 17-row progress counter in sync after reloads and user switches
- Update the 17-row procedure observation log with the final persistence/hydration result

## Background
After the execution save URL and schema-drift fixes, production verification showed that saved records needed to be rehydrated into the local Zustand store on page load to preserve progress such as `1/17` after reload.

## Checks
- Browser verification: Save → Reload → Display
- Confirm progress counter remains synced after reload
- git diff --stat

## Notes
This is a final persistence hydration fix. It does not change the 17-row procedure model itself.
