/**
 * Domain-level ConflictError for iceberg persistence.
 * Moved from SharePointIcebergRepository to avoid store → infra dependency.
 */
export class ConflictError extends Error {
  constructor(message = 'Conflict detected') {
    super(message);
    this.name = 'ConflictError';
  }
}
