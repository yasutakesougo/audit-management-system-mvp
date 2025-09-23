// Shared audit feature types
export type AuditChannel = 'SPO' | 'MSAL' | 'UI' | 'System';

export interface AuditEventDTO {
  ts: string;
  actor: string;
  action: string;
  entity: string;
  entity_id?: string;
  channel: AuditChannel;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

// SharePoint list item representation (fields ensured by provisioning script)
export interface AuditListItemDTO {
  Id: number;
  Title: string;
  ts?: string;
  actor?: string;
  action?: string;
  entity?: string;
  entity_id?: string | null;
  channel?: AuditChannel;
  after_json?: string | null;
  entry_hash?: string;
}

// Insert body we send to SharePoint when creating new audit list items ($batch or single REST).
// This is a strict shape (all fields required) so we can eliminate any usage in sync hooks.
export interface AuditInsertItemDTO {
  Title: string;
  ts: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null; // normalized null when absent
  channel: AuditChannel;
  after_json: string | null; // canonical JSON or null
  entry_hash: string; // deterministic hash for idempotency / duplicate detection
}

export interface AuditBatchMetrics {
  success: number;
  duplicates: number;
  failed: number;
  total: number;
  parserFallbackCount?: number;
}

export type BatchItemStatus = 'success' | 'duplicate' | 'failed';
