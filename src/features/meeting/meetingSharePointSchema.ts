/**
 * meetingSharePointSchema.ts — Re-export barrel for Meeting System provisioning data.
 *
 * This file previously contained all provisioning definitions inline (589 lines).
 * They have been extracted into dedicated files to adhere to the 600-line guardrail:
 *
 * - meetingSpSchema.ts          → MEETING_SHAREPOINT_SCHEMA (JSON list/field/view/permission defs)
 * - meetingProvisioningScript.ts → MEETING_PROVISIONING_SCRIPT, MEETING_ENV_CONFIG
 *
 * This barrel maintains backward-compatible exports so existing import paths continue to work.
 */

export { MEETING_ENV_CONFIG, MEETING_PROVISIONING_SCRIPT } from './meetingProvisioningScript';
export { MEETING_SHAREPOINT_SCHEMA, default } from './meetingSpSchema';
