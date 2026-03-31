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

type ODataPrimitive = string | number | boolean;

// eslint-disable-next-line no-restricted-syntax
const fmt = (v: ODataPrimitive): string => {
  if (typeof v === 'string') return `'${escapeODataString(v)}'`;
  return String(v);
};

// ── Comparison operators ─────────────────────────────────────────────────────

// eslint-disable-next-line no-restricted-syntax
export const buildEq = (field: string, value: ODataPrimitive): string =>
  `${field} eq ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildNe = (field: string, value: ODataPrimitive): string =>
  `${field} ne ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildGe = (field: string, value: string | number): string =>
  `${field} ge ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildLe = (field: string, value: string | number): string =>
  `${field} le ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildGt = (field: string, value: string | number): string =>
  `${field} gt ${fmt(value)}`;

// eslint-disable-next-line no-restricted-syntax
export const buildLt = (field: string, value: string | number): string =>
  `${field} lt ${fmt(value)}`;

// ── Logical combinators ──────────────────────────────────────────────────────

/** Join non-empty filter strings with ' and '. */
export const joinAnd = (filters: (string | undefined | null | false)[]): string =>
  filters.filter(Boolean).join(' and ');

/** Join non-empty filter strings with ' or '. */
export const joinOr = (filters: (string | undefined | null | false)[]): string =>
  filters.filter(Boolean).join(' or ');
