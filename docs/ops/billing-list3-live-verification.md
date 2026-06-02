# Coffee Billing List3 Live Verification

## Purpose

`/billing` is the Coffee Monthly Billing Data workflow. It aggregates coffee order history, tracks payment status, and exports monthly billing data.

For the 1-week field acceptance sprint, use [billing-acceptance-sprint.md](./billing-acceptance-sprint.md). This document remains the technical live verification guide for SharePoint List3 and persistence wiring.

This workflow intentionally uses a different SharePoint site from the main app:

| Area | SharePoint site |
| --- | --- |
| Main app, Iceberg-PDCA, `/admin/status` | `/sites/welfare` |
| Coffee billing orders | `/sites/2` |

`BillingOrders` is the only cross-site list in this flow. It uses a dedicated SharePoint site override and is not part of the normal `/sites/welfare` health drift check.

## Required Environment

Local and runtime SharePoint configuration must keep the main app on `/sites/welfare` while overriding only BillingOrders:

```env
VITE_SP_SITE_RELATIVE=/sites/welfare
VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE=/sites/2
VITE_SP_LIST_BILLING_ORDERS=c4be5492-9803-4fc6-ac7e-82d10e95ff6d
```

Apply the same values to the deployed runtime env when validating against live SharePoint, for example `public/env.runtime.json` or the hosted `env.runtime.json`.

## SharePoint List

BillingOrders points to the coffee order history list under `/sites/2`.

| Property | Value |
| --- | --- |
| Site | `https://isogokatudouhome.sharepoint.com/sites/2` |
| List URL name | `List3` |
| List title | `コーヒー注文履歴` |
| List GUID | `c4be5492-9803-4fc6-ac7e-82d10e95ff6d` |

The expected API target is:

```text
/sites/2/_api/web/lists(guid'c4be5492-9803-4fc6-ac7e-82d10e95ff6d')
```

If requests go to `/sites/welfare/_api/...` for BillingOrders, the app is using stale runtime env or an old dev server.

## Required Physical Columns

List3 must include these payment persistence columns:

| Display name | Type | Notes |
| --- | --- | --- |
| `PaymentStatus` | Choice | Choices: `未精算`, `精算済み` |
| `PaidAt` | Date and Time | Stores settlement timestamp |
| `PaidBy` | Single line of text | Stores the settlement actor |

If these columns are missing, `/billing` shows a persistence warning and does not treat SharePoint persistence as complete.

## Health Diagnostics

`/admin/status` and Iceberg-PDCA diagnostics validate the normal app site, `/sites/welfare`.

Because BillingOrders lives under `/sites/2`, `billing_orders` is excluded from the normal site drift diagnostics when `VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE` differs from `VITE_SP_SITE_RELATIVE`. This prevents false FAIL results against `/sites/welfare`.

Expected health outcome after the override is configured:

```text
FAIL:0
```

WARN-level schema drift can still appear for unrelated column-name differences and should be reviewed separately.

## Live Verification

1. Restart the dev server or redeploy runtime env changes.
2. Hard reload the browser.
3. Open `/billing`.
4. Confirm the page opens the Coffee Monthly Billing Data dashboard directly, without HubLanding or Coming Soon cards.
5. Select `2025-08`.
6. Confirm real coffee order rows are displayed.
7. Run one individual settlement action.
8. Confirm the corresponding List3 rows are updated:
   - `PaymentStatus = 精算済み`
   - `PaidAt` is set
   - `PaidBy` is set
9. Reload `/billing`.
10. Confirm the settled state remains visible.
11. Confirm CSV export works from the same screen.
12. Confirm print works from the same screen.

## Troubleshooting

If BillingOrders cannot be reached:

- Confirm the request path uses `/sites/2`, not `/sites/welfare`.
- Confirm `VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE=/sites/2`.
- Confirm `VITE_SP_LIST_BILLING_ORDERS=c4be5492-9803-4fc6-ac7e-82d10e95ff6d`.
- Restart `npm run dev`.
- Clear Vite cache if stale env is suspected:

```bash
rm -rf node_modules/.vite
npm run dev
```

If the page loads but payment persistence is unavailable:

- Confirm `PaymentStatus`, `PaidAt`, and `PaidBy` exist on `/sites/2/Lists/List3`.
- Hard reload `/billing` after column creation.

If records do not appear for the selected month:

- Confirm the selected month matches the List3 data month.
- Confirm `Served` values are set for the target rows.
- Current coffee billing uses a fixed unit price of 50 yen per order count.
