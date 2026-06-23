import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const fixturePath = (name: string): string =>
  path.join(process.cwd(), 'tests', 'fixtures', 'nvidia-nim', name);

const readFixture = (name: string): unknown =>
  JSON.parse(readFileSync(fixturePath(name), 'utf8'));

const parseIntField = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

function validateApplyApprovedPreviewPayload(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['payload must be an object'];
  }

  const payload = value as Record<string, unknown>;
  const errors: string[] = [];

  const schemaVersion = typeof payload.schemaVersion === 'string' ? payload.schemaVersion : undefined;
  if (schemaVersion !== 'nvidia-nim-apply-approved-preview/1.0') {
    errors.push('schemaVersion must be nvidia-nim-apply-approved-preview/1.0');
  }

  if (typeof payload.generatedAt !== 'string' || payload.generatedAt.trim().length === 0) {
    errors.push('generatedAt must be a non-empty string');
  }

  if (typeof payload.inputPath !== 'string' || payload.inputPath.trim().length === 0) {
    errors.push('inputPath must be a non-empty string');
  }

  if (typeof payload.outputPath !== 'string' || payload.outputPath.trim().length === 0) {
    errors.push('outputPath must be a non-empty string');
  }

  if (!payload.summary || typeof payload.summary !== 'object' || Array.isArray(payload.summary)) {
    errors.push('summary must be an object');
  } else {
    const summary = payload.summary as Record<string, unknown>;
    const total = summary.total;
    const approved = summary.approved;
    const warnings = summary.warnings;
    if (!parseIntField(total) || !parseIntField(approved) || !parseIntField(warnings)) {
      errors.push('summary.total/approved/warnings must be non-negative integers');
    }
  }

  if (!Array.isArray(payload.items)) {
    errors.push('items must be an array');
  } else {
    payload.items.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`items[${index}] must be an object`);
        return;
      }

      const candidate = item as Record<string, unknown>;
      if (typeof candidate.artifactId !== 'string') {
        errors.push(`items[${index}].artifactId must be string`);
      }
      if (typeof candidate.path !== 'string') {
        errors.push(`items[${index}].path must be string`);
      }
      if (typeof candidate.suggestedTitle !== 'string') {
        errors.push(`items[${index}].suggestedTitle must be string`);
      }
      if (!Array.isArray(candidate.labels) || candidate.labels.some((label) => typeof label !== 'string')) {
        errors.push(`items[${index}].labels must be array of strings`);
      }
      if (typeof candidate.reason !== 'string') {
        errors.push(`items[${index}].reason must be string`);
      }
    });
  }

  if (!Array.isArray(payload.warnings)) {
    errors.push('warnings must be an array');
  } else {
    payload.warnings.forEach((warning, index) => {
      if (!warning || typeof warning !== 'object' || Array.isArray(warning)) {
        errors.push(`warnings[${index}] must be an object`);
        return;
      }

      const warningRecord = warning as Record<string, unknown>;
      if (typeof warningRecord.type !== 'string') {
        errors.push(`warnings[${index}].type must be string`);
      }
      if (!parseIntField(warningRecord.line)) {
        errors.push(`warnings[${index}].line must be non-negative integer`);
      }
      if (typeof warningRecord.message !== 'string') {
        errors.push(`warnings[${index}].message must be string`);
      }
      if ('raw' in warningRecord && warningRecord.raw !== null && typeof warningRecord.raw !== 'string') {
        errors.push(`warnings[${index}].raw must be string or null`);
      }
    });
  }

  if (!payload.preflight || typeof payload.preflight !== 'object' || Array.isArray(payload.preflight)) {
    errors.push('preflight must be an object');
  } else {
    const preflight = payload.preflight as Record<string, unknown>;
    if (typeof preflight.passed !== 'boolean') {
      errors.push('preflight.passed must be boolean');
    }
    if (!Array.isArray(preflight.failures)) {
      errors.push('preflight.failures must be array');
    }

    if (preflight.passed !== true) {
      errors.push('preflight must be passed');
    }

    if (Array.isArray(preflight.failures) && preflight.failures.length > 0) {
      errors.push('preflight failures must be empty');
    }
  }

  if (
    payload.summary &&
    typeof payload.summary === 'object' &&
    !Array.isArray(payload.summary) &&
    Array.isArray(payload.items) &&
    Array.isArray(payload.warnings)
  ) {
    const summary = payload.summary as Record<string, unknown>;
    if (
      typeof summary.approved === 'number' &&
      typeof summary.warnings === 'number' &&
      summary.approved === payload.items.length &&
      summary.warnings === payload.warnings.length
    ) {
      return errors;
    }

    if (typeof summary.approved !== 'number' || summary.approved !== payload.items.length) {
      errors.push('summary.approved must equal items.length');
    }
    if (typeof summary.warnings !== 'number' || summary.warnings !== payload.warnings.length) {
      errors.push('summary.warnings must equal warnings.length');
    }
  }

  return errors;
}

describe('apply-approved preview handoff contract', () => {
  it('valid payload passes boundary contract validation', () => {
    const payload = readFixture('apply-approved-handoff-valid.json');
    const errors = validateApplyApprovedPreviewPayload(payload);

    expect(errors).toHaveLength(0);
  });

  it('invalid schemaVersion is rejected', () => {
    const payload = readFixture('apply-approved-handoff-invalid-schema-version.json');
    const errors = validateApplyApprovedPreviewPayload(payload);

    expect(errors).toContain('schemaVersion must be nvidia-nim-apply-approved-preview/1.0');
  });

  it('preflight.failed / not-passed is rejected', () => {
    const payload = readFixture('apply-approved-handoff-invalid-preflight.json');
    const errors = validateApplyApprovedPreviewPayload(payload);

    expect(errors).toContain('preflight must be passed');
    expect(errors).toContain('preflight failures must be empty');
  });

  it('summary and counts mismatch is rejected', () => {
    const payload = readFixture('apply-approved-handoff-invalid-summary-mismatch.json');
    const errors = validateApplyApprovedPreviewPayload(payload);

    expect(errors).toContain('summary.approved must equal items.length');
    expect(errors).toContain('summary.warnings must equal warnings.length');
  });

  it('missing required item fields are rejected', () => {
    const payload = readFixture('apply-approved-handoff-invalid-item-field.json');
    const errors = validateApplyApprovedPreviewPayload(payload);

    expect(errors.join('\n')).toContain('items[0].artifactId must be string');
    expect(errors.join('\n')).toContain('items[0].suggestedTitle must be string');
  });

  it('partial handoff input is rejected', () => {
    const payload = readFixture('apply-approved-handoff-partial.json');
    const errors = validateApplyApprovedPreviewPayload(payload);

    expect(errors).toContain('outputPath must be a non-empty string');
  });
});
