/**
 * OData query builder helpers for SharePoint $filter expressions.
 *
 * These functions replace hand-written template literals such as
 *   `${FIELD.foo} eq '${value}'`
 * with typed, escape-safe calls:
 *   buildEq(FIELD.foo, value)
 *
 * All string values are escaped via escapeODataString (src/lib/odata.ts).
 * boolean values emit bare `true`/`false`; numbers emit bare numerals.
 */

import { escapeODataString } from '@/lib/odata';
import type { SpFieldName } from '@/sharepoint/fields/fieldUtils';

type ODataPrimitive = string | number | boolean | null;

/**
 * Phase 2a: field 引数は SSOT 由来（defineFieldMap 経由）か、
 * 動的解決された string を受け入れる transitional union。
 * Phase 2d で `SpFieldName` のみに narrow 予定。
 */
type SpField = SpFieldName | string;

// eslint-disable-next-line no-restricted-syntax
const fmt = (v: ODataPrimitive): string => {
  if (typeof v === 'string') {
    // If it's already an OData datetime literal, don't wrap it in extra quotes
    if (v.startsWith("datetime'")) return v;
    return `'${escapeODataString(v)}'`;
  }
  return String(v);
};

// ── Comparison operators ─────────────────────────────────────────────────────

// eslint-disable-next-line no-restricted-syntax
export const buildEq = (field: SpField, value: ODataPrimitive): string =>
  `${field} eq ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildNe = (field: SpField, value: ODataPrimitive): string =>
  `${field} ne ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildGe = (field: SpField, value: string | number): string =>
  `${field} ge ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildLe = (field: SpField, value: string | number): string =>
  `${field} le ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildGt = (field: SpField, value: string | number): string =>
  `${field} gt ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildLt = (field: SpField, value: string | number): string =>
  `${field} lt ${fmt(value)}`;

// ── Search & Functions ───────────────────────────────────────────────────────

/** substringof('value', field) */
// eslint-disable-next-line no-restricted-syntax
export const buildSubstringOf = (field: SpField, value: string): string =>
  `substringof('${escapeODataString(value)}', ${field})`;

/** startswith(field, 'value') */
// eslint-disable-next-line no-restricted-syntax
export const buildStartsWith = (field: SpField, value: string): string =>
  `startswith(${field}, '${escapeODataString(value)}')`;

/** OData datetime literal: datetime'YYYY-MM-DDTHH:mm:ssZ' */
// eslint-disable-next-line no-restricted-syntax
export const buildDateTime = (isoDate: string): string =>
  `datetime'${isoDate}'`;

// ── Logical combinators ──────────────────────────────────────────────────────

/** Join non-empty filter strings with ' and '. */
export const joinAnd = (filters: (string | undefined | null | false)[]): string =>
  filters.filter(Boolean).join(' and ');

/** Join non-empty filter strings with ' or '. */
export const joinOr = (filters: (string | undefined | null | false)[]): string =>
  filters.filter(Boolean).join(' or ');
