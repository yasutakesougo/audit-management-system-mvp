/**
 * SharePoint Field Schema XML builder
 * Extracted from spClient.ts for single-responsibility.
 */

import type { SpFieldDef } from './types';

// ── XML helpers ──
export const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const trimGuidBraces = (value: string): string => value.replace(/[{}]/g, '').trim();

export const withGuidBraces = (value: string): string => {
  const trimmed = trimGuidBraces(value);
  return trimmed ? `{${trimmed}}` : '';
};

/**
 * Build a CAML `<Field>` XML string from a field definition.
 */
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
  if (def.indexed) addAttr('Indexed', 'TRUE');
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
