/**
 * OData String Escaping Utilities
 *
 * Centralised escaping for OData filter values used across
 * SharePoint repository implementations.
 *
 * Previously duplicated in 8+ files as `escapeOData` / `escapeODataString`.
 *
 * OData string literals are enclosed in single quotes. The only mandatory
 * escape within a string literal is doubling the single-quote character.
 * Newlines and tabs should also be stripped to prevent filter-injection
 * via multi-line strings.
 *
 * @see https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_PrimitiveLiterals
 */

/**
 * Escape a string value for use inside an OData $filter expression.
 *
 * Example:
 * ```ts
 * const filter = `UserCode eq '${escapeODataString(userId)}'`;
 * ```
 */
export function escapeODataString(value: string): string {
  return value
    .replace(/'/g, "''")      // OData: double single-quotes
    .replace(/[\r\n\t]/g, '') // Strip control characters that could break filter syntax
    .replace(/%27/gi, "''");  // Percent-encoded single-quote
}
