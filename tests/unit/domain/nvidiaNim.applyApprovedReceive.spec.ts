import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseApplyApprovedPlanJson,
  validateApplyApprovedPlan,
  NVIDIA_APPLY_APPROVED_DRYRUN_SCHEMA_VERSION,
} from '@/domain/nvidiaNim/applyApprovedReceive';

const fixturePath = (name: string): string =>
  path.join(process.cwd(), 'tests', 'fixtures', 'nvidia-nim', name);

const readFixture = (name: string): string =>
  readFileSync(fixturePath(name), 'utf8');

describe('validateApplyApprovedPlan', () => {
  it('valid payload is accepted', () => {
    const input = JSON.parse(readFixture('apply-approved-receive-valid.json'));
    const result = validateApplyApprovedPlan(input);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.payload.schemaVersion).toBe(NVIDIA_APPLY_APPROVED_DRYRUN_SCHEMA_VERSION);
    expect(result.payload.summary.approved).toBe(2);
    expect(result.payload.items).toHaveLength(2);
    expect(result.payload.warnings).toHaveLength(1);
  });

  it('non-matching schemaVersion is rejected', () => {
    const input = JSON.parse(readFixture('apply-approved-receive-invalid-schema-version.json'));
    const result = validateApplyApprovedPlan(input);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.errors.join('\n')).toContain('schemaVersion');
    expect(result.errors.join('\n')).toContain('nvidia-nim-apply-approved-dry-run/1.0');
  });

  it('malformed JSON is rejected', () => {
    const result = parseApplyApprovedPlanJson('{invalid-json');

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.errors).toEqual(['payload: invalid JSON']);
  });

  it('missing required item field is rejected', () => {
    const input = JSON.parse(readFixture('apply-approved-receive-invalid-item.json'));
    const result = parseApplyApprovedPlanJson(JSON.stringify(input));

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.errors.join('\n')).toContain('items.0.reason');
    expect(result.errors.join('\n')).toContain('string');
  });
});
