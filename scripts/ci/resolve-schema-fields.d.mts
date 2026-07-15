export type SchemaFieldAliases = Record<string, readonly string[]>;

export type SchemaFieldResolution = {
  resolved: Record<string, string>;
  missing: string[];
  ambiguous: { logical: string; actual: string[] }[];
  resolutions: {
    logical: string;
    actual: string;
    method: string;
    candidate: string;
  }[];
};

export function resolveSchemaFields(
  actualNames?: string[],
  logicalNames?: string[],
  aliases?: SchemaFieldAliases,
): SchemaFieldResolution;

export function mapSchemaPayload(
  payload: Record<string, unknown>,
  resolved?: Record<string, string>,
): Record<string, unknown>;
