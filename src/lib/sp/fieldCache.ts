/**
 * SharePoint Fields Cache & Schema Utilities
 *
 * spClient.ts から抽出。フィールドキャッシュ（sessionStorage）、
 * XML スキーマ構築、およびオプショナルフィールド管理ロジック。
 */
import type { SpFieldDef } from '@/lib/sp/types';
import { escapeXml, withGuidBraces } from '@/lib/sp/types';

// ─── Fields Cache (sessionStorage) ───────────────────────────────

export const FIELDS_CACHE_TTL_MS = 20 * 60 * 1000; // 20分

export function nowMs(): number {
  return Date.now();
}

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeJsonStringify(obj: unknown): string | null {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

export function makeFieldsCacheKey(siteUrl: string, listTitle: string): string {
  return `sp.fieldsCache.v1::${siteUrl}::${listTitle}`;
}

// ─── Field XML Schema Builder ────────────────────────────────────

export const buildFieldSchema = (def: SpFieldDef): string => {
  const attributes: string[] = [];
  const addAttr = (key: string, raw: string | number | boolean | undefined) => {
    if (raw === undefined || raw === null || raw === '') return;
    const value = typeof raw === 'boolean' ? (raw ? 'TRUE' : 'FALSE') : String(raw);
    attributes.push(`${key}="${escapeXml(value)}"`);
  };

  addAttr('Name', def.internalName);
  addAttr('StaticName', def.internalName);
  addAttr('DisplayName', def.displayName ?? def.internalName);
  addAttr('Type', def.type);
  if (def.required) addAttr('Required', 'TRUE');
  if (def.richText) addAttr('RichText', 'TRUE');
  if (def.dateTimeFormat) addAttr('Format', def.dateTimeFormat);
  if (def.type === 'Lookup') {
    if (def.lookupListId) addAttr('List', withGuidBraces(def.lookupListId));
    addAttr('ShowField', def.lookupFieldName ?? 'Title');
    if (def.allowMultiple) addAttr('Mult', 'TRUE');
  } else if (def.allowMultiple) {
    addAttr('Mult', 'TRUE');
  }

  if (def.type === 'Boolean' && typeof def.default === 'boolean') {
    addAttr('Default', def.default ? '1' : '0');
  }

  const inner: string[] = [];
  if (def.description) {
    inner.push(`<Description>${escapeXml(def.description)}</Description>`);
  }
  if ((def.type === 'Choice' || def.type === 'MultiChoice') && def.choices?.length) {
    const choiceXml = def.choices.map((choice) => `<CHOICE>${escapeXml(choice)}</CHOICE>`).join('');
    inner.push(`<CHOICES>${choiceXml}</CHOICES>`);
    if (def.default && typeof def.default === 'string') {
      inner.push(`<Default>${escapeXml(def.default)}</Default>`);
    }
  } else if (def.default !== undefined && def.type !== 'Boolean') {
    inner.push(`<Default>${escapeXml(String(def.default))}</Default>`);
  }

  const attrs = attributes.join(' ');
  const body = inner.join('');
  return `<Field ${attrs}>${body}</Field>`;
};

// ─── Optional Fields Cache (in-memory) ──────────────────────────

const missingOptionalFieldsCache = new Map<string, Set<string>>();

export const getMissingSet = (listTitle: string): Set<string> => {
  let current = missingOptionalFieldsCache.get(listTitle);
  if (!current) {
    current = new Set<string>();
    missingOptionalFieldsCache.set(listTitle, current);
  }
  return current;
};

export const markOptionalMissing = (listTitle: string, field: string) => {
  if (!field) return;
  getMissingSet(listTitle).add(field);
};

export const extractMissingField = (message: string): string | null => {
  const match = message.match(/'([^']+)'/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

export const buildSelectFields = (baseFields: readonly string[], optionalFields: readonly string[], missing: Set<string>): string[] => {
  const base = baseFields.filter((field) => !missing.has(field));
  const optional = optionalFields.filter((field) => !missing.has(field));
  const merged = [...base, ...optional];
  return Array.from(new Set(merged));
};

// ─── Cache clear utilities ───────────────────────────────────────

/**
 * Fields キャッシュを手動クリア（デバッグ用）
 */
export function clearFieldsCacheFor(listTitle: string, siteUrl: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const key = makeFieldsCacheKey(siteUrl, listTitle);
  sessionStorage.removeItem(key);
  console.log('[spClient][fieldsCache] 🗑️ cleared', { listTitle });
}

/**
 * 全 Fields キャッシュをクリア
 */
export function clearAllFieldsCache(): void {
  if (typeof sessionStorage === 'undefined') return;
  const prefix = 'sp.fieldsCache.v1::';
  let count = 0;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix)) {
      sessionStorage.removeItem(key);
      count++;
    }
  }
  console.log('[spClient][fieldsCache] 🗑️ cleared all', { count });
}

/**
 * Reset missing optional fields cache (test use)
 */
export function resetMissingOptionalFieldsCache(): void {
  missingOptionalFieldsCache.clear();
}
