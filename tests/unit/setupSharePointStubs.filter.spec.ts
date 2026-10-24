import { describe, expect, it } from 'vitest';
import { filterODataItems } from '../e2e/_helpers/setupSharePointStubs';

describe('setupSharePointStubs OData filter parser regression', () => {
  const sampleItems = [
    {
      Id: 1,
      ID: 1,
      Title: 'Morning Transport',
      Status: '予定',
      EventDate: '2026-04-24T10:00:00Z',
      EndDate: '2026-04-24T12:00:00Z',
    },
    {
      Id: 2,
      ID: 2,
      Title: 'Afternoon Transport',
      Status: '完了',
      EventDate: '2026-04-25T13:00:00Z',
      EndDate: '2026-04-25T15:00:00Z',
    },
    {
      Id: 3,
      ID: 3,
      Title: 'Corrupt Date Entry',
      Status: '予定',
      EventDate: 'invalid-date-string',
      EndDate: 'invalid-date-string',
    },
  ];

  it('matches datetime literals with ge and le range comparison (transport regression)', () => {
    const filter = "EventDate lt datetime'2026-04-25T14:59:59Z' and EndDate ge datetime'2026-04-22T15:00:00Z'";
    const matched = filterODataItems(sampleItems, filter);
    expect(matched).toHaveLength(2);
    expect(matched.map((item) => item.Id)).toEqual([1, 2]);
  });

  it('correctly handles boundary equality for ge/gt and le/lt', () => {
    const exactDate = '2026-04-24T10:00:00Z';
    const geMatched = filterODataItems(sampleItems, `EventDate ge datetime'${exactDate}'`);
    expect(geMatched.map((item) => item.Id)).toContain(1);

    const gtMatched = filterODataItems(sampleItems, `EventDate gt datetime'${exactDate}'`);
    expect(gtMatched.map((item) => item.Id)).not.toContain(1);

    const leMatched = filterODataItems(sampleItems, `EventDate le datetime'${exactDate}'`);
    expect(leMatched.map((item) => item.Id)).toContain(1);

    const ltMatched = filterODataItems(sampleItems, `EventDate lt datetime'${exactDate}'`);
    expect(ltMatched.map((item) => item.Id)).not.toContain(1);
  });

  it('preserves existing numeric ID and string equality', () => {
    const idFilter = 'ID eq 1 and Status eq \'予定\'';
    const matched = filterODataItems(sampleItems, idFilter);
    expect(matched).toHaveLength(1);
    expect(matched[0].Id).toBe(1);

    const numericGtFilter = 'ID gt 1';
    const matchedGt = filterODataItems(sampleItems, numericGtFilter);
    expect(matchedGt.map((item) => item.Id)).toEqual([2, 3]);
  });

  it('does not treat invalid dates as matching', () => {
    const filterWithInvalidLiteral = "EventDate ge datetime'not-a-valid-date'";
    expect(filterODataItems(sampleItems, filterWithInvalidLiteral)).toEqual([]);

    const filterTargetingValidDate = "EventDate ge datetime'2026-04-20T00:00:00Z'";
    const matched = filterODataItems(sampleItems, filterTargetingValidDate);
    expect(matched.map((item) => item.Id)).not.toContain(3);
  });
});
