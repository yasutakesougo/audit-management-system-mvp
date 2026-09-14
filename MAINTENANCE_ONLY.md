# Maintenance Only Policy

Status: **MAINTENANCE ONLY**

This repository is the current interim system. A replacement system is under construction.

From this point forward, this repository is not an active product-development target.

## Allowed changes

Changes are limited to work required to keep interim operation safe and viable:

- security and information-exposure fixes;
- data-integrity or data-loss prevention;
- authentication and authorization defects;
- incidents that block current operations;
- changes strictly required for migration to the replacement system.

## Not allowed by default

Do not invest in:

- new features;
- UX or visual improvements;
- refactoring for future extensibility;
- architecture modernization;
- dependency upgrades unless required for a critical security or operational fix;
- CI/test expansion unless required to prove a critical fix;
- performance or developer-experience improvements that do not affect interim operation.

## Decision rule

If a proposed change is not necessary for **security, data integrity, authentication/authorization, an operational blocker, or migration readiness**, do not implement it in this repository.

When in doubt, implement the capability in the replacement system instead.

## Operational lifecycle

1. Continue using only the currently viable portions of this system on an interim basis.
2. Keep maintenance effort to the minimum necessary for safe operation.
3. Build and validate the replacement system separately.
4. Migrate required data and workflows to the replacement system.
5. Stop operational use of this repository after migration acceptance.
6. Retire/archive this repository only after the replacement system is confirmed operational and rollback/data-retention requirements are satisfied.

## Change authority

Critical fixes may still be merged when their necessity and scope are clear. Production deployment remains a separate decision from merge.

This policy does not authorize destructive SharePoint/M365/Entra/Firebase changes, credential rotation, or history rewriting by itself.
