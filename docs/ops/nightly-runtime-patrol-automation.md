# Nightly Runtime Patrol - Automation Guide

This document describes the automated execution of the Nightly Runtime Patrol via GitHub Actions.

## Workflow Overview
The patrol runs as a GitHub Actions workflow to verify the health of the SharePoint infrastructure and telemetry logs and then notifies the operational team via Microsoft Teams.

- **Workflow File**: `.github/workflows/nightly-runtime-patrol.yml`
- **Script**: `scripts/ops/nightly-runtime-patrol.ts`

## Schedule
The workflow is scheduled to run daily in the early morning (JST).

- **Time**: **06:00 JST** daily
- **GitHub Cron**: `0 21 * * *` (UTC)

## Manual Execution
If you need to run the patrol manually (e.g., after a production fix or during maintenance):

1. Go to the **Actions** tab in GitHub.
2. Select **Nightly Runtime Patrol** from the sidebar.
3. Click **Run workflow** -> Select branch (main) -> **Run workflow**.

## Required Configuration (GitHub Secrets)
The following secrets must be configured in the repository settings for the workflow to operate correctly:

| `AAD_APP_ID`       | Azure AD Application (Client) ID. | **Yes** |
| `AAD_TENANT_ID`    | Azure AD Tenant ID. | **Yes** |
| `SPO_CERT_BASE64`  | Base64 encoded PFX certificate. | **Yes** |
| `SPO_CERT_PASSWORD`| Password for the certificate. | **Yes** |
| `SHAREPOINT_SITE`  | The full URL of the target SharePoint site. | **Yes** |
| `TEAMS_WEBHOOK_URL`| The Incoming Webhook URL for the Teams channel. | No |
| `TEAMS_MENTION_UPN`| Teams UPN for responsible person. | No |

## Outputs and Artifacts
- **Teams Notification**: A summary card is sent to the configured Teams channel.
- **Markdown Report**: A detailed report is committed to `docs/nightly-patrol/runtime-summary-YYYY-MM-DD.md`.
- **Workflow Artifacts**: The raw `.nightly/` directory (JSON/Markdown) is uploaded to the workflow run as an artifact (retention: 90 days).

## Troubleshooting
- **Workflow Fails**: Check the logs in GitHub Actions. Usually caused by an expired `SP_ACCESS_TOKEN`.
- **No Teams Notification**: Check if `TEAMS_WEBHOOK_URL` is configured correctly. The workflow will log a warning but won't fail if this secret is missing.
- **No Reports in Docs**: Ensure the workflow has permission to push to the repository (`permissions: contents: write` is already set).
