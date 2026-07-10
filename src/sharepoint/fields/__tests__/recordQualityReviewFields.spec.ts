import { describe, expect, it } from 'vitest';
import { DATA_OS_RESOURCE_REGISTRY } from '@/lib/data/dataOSResourceRegistry';
import { findListEntry } from '@/sharepoint/spListRegistry';
import {
  RECORD_QUALITY_REVIEW_CANDIDATES,
  RECORD_QUALITY_REVIEW_ESSENTIAL_FIELDS,
  RECORD_QUALITY_REVIEW_FIELDS,
  RECORD_QUALITY_REVIEW_LIST_TITLE,
  RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS,
} from '../recordQualityReviewFields';

describe('RecordQualityReview SharePoint definitions', () => {
  it('registers the review list for optional self-healing provisioning', () => {
    const entry = findListEntry('record_quality_review');

    expect(entry).toBeDefined();
    expect(entry?.resolve()).toBe(RECORD_QUALITY_REVIEW_LIST_TITLE);
    expect(entry?.lifecycle).toBe('optional');
    expect(entry?.operations).toEqual(['R', 'W']);
    expect(entry?.essentialFields).toEqual(RECORD_QUALITY_REVIEW_ESSENTIAL_FIELDS);
    expect(entry?.provisioningFields).toBe(RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS);
  });

  it('keeps every persistence adapter field in the provisioning contract', () => {
    const fieldNames = new Set(
      RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS.map((field) => field.internalName),
    );

    expect(fieldNames).toEqual(
      new Set([
        RECORD_QUALITY_REVIEW_FIELDS.recordId,
        RECORD_QUALITY_REVIEW_FIELDS.sourceRecordId,
        RECORD_QUALITY_REVIEW_FIELDS.status,
        RECORD_QUALITY_REVIEW_FIELDS.reviewerId,
        RECORD_QUALITY_REVIEW_FIELDS.reviewerName,
        RECORD_QUALITY_REVIEW_FIELDS.suggestedCategoriesJson,
        RECORD_QUALITY_REVIEW_FIELDS.missingInfoHintsJson,
        RECORD_QUALITY_REVIEW_FIELDS.reviewerNotesJson,
        RECORD_QUALITY_REVIEW_FIELDS.createdAt,
        RECORD_QUALITY_REVIEW_FIELDS.updatedAt,
      ]),
    );
  });

  it('keeps original support record text out of the review schema', () => {
    const fieldNames = RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS.map(
      (field) => field.internalName,
    );

    expect(fieldNames).not.toContain('Body');
    expect(fieldNames).not.toContain('Content');
    expect(fieldNames).not.toContain('OriginalRecordText');
  });

  it('defines indexed lookup fields used by the data provider store', () => {
    const fields = new Map(
      RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS.map((field) => [
        field.internalName,
        field,
      ]),
    );

    expect(fields.get(RECORD_QUALITY_REVIEW_FIELDS.recordId)).toMatchObject({
      type: 'Text',
      required: true,
      indexed: true,
    });
    expect(fields.get(RECORD_QUALITY_REVIEW_FIELDS.updatedAt)).toMatchObject({
      type: 'DateTime',
      required: true,
      indexed: true,
      dateTimeFormat: 'DateTime',
    });
    expect(fields.get(RECORD_QUALITY_REVIEW_FIELDS.status)).toMatchObject({
      type: 'Choice',
      choices: ['draft', 'accepted', 'revised', 'discarded'],
      default: 'draft',
    });
  });

  it('registers the same schema in Data OS resource definitions', () => {
    const definition = DATA_OS_RESOURCE_REGISTRY.RecordQualityReview;

    expect(definition).toEqual({
      resourceName: 'RecordQualityReview',
      defaultListTitle: RECORD_QUALITY_REVIEW_LIST_TITLE,
      fields: RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS,
    });
  });

  it('uses canonical names first and includes encoded SharePoint candidates', () => {
    expect(RECORD_QUALITY_REVIEW_CANDIDATES.recordId[0]).toBe('RecordId');
    expect(RECORD_QUALITY_REVIEW_CANDIDATES.recordId).toContain('Record_x0020_ID');
    expect(RECORD_QUALITY_REVIEW_CANDIDATES.sourceRecordId[0]).toBe(
      'SourceRecordId',
    );
    expect(RECORD_QUALITY_REVIEW_CANDIDATES.sourceRecordId).toContain(
      'Source_x0020_Record_x0020_ID',
    );
    expect(RECORD_QUALITY_REVIEW_CANDIDATES.reviewerNotesJson).toContain(
      'Reviewer_x0020_Notes_x0020_JSON',
    );
  });
});
