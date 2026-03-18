import { describe, it, expect } from 'vitest';
import { extractODataIndexCandidates } from './extractor';

describe('extractODataIndexCandidates', () => {
  it('1. Status eq \'Open\'', () => {
    const res = extractODataIndexCandidates({ filter: "Status eq 'Open'" });
    expect(res).toEqual([{ field: 'Status', reason: 'comparison' }]);
  });

  it('2. UserCode eq \'I022\' and RecordDate ge \'2026-03-01\'', () => {
    const res = extractODataIndexCandidates({ filter: "UserCode eq 'I022' and RecordDate ge '2026-03-01'" });
    expect(res).toEqual([
      { field: 'UserCode', reason: 'comparison' },
      { field: 'RecordDate', reason: 'comparison' },
    ]);
  });

  it('3. startswith(Title,\'A\')', () => {
    const res = extractODataIndexCandidates({ filter: "startswith(Title,'A')" });
    expect(res).toEqual([{ field: 'Title', reason: 'startswith' }]);
  });

  it('4. $orderby=Modified desc', () => {
    const res = extractODataIndexCandidates({ orderby: "Modified desc" });
    expect(res).toEqual([{ field: 'Modified', reason: 'orderby' }]);
  });

  it('5. contains(Title,\'abc\')', () => {
    const res = extractODataIndexCandidates({ filter: "contains(Title,'abc')" });
    expect(res).toEqual([{ field: 'Title', reason: 'contains' }]);
  });

  it('6. 不正文字列では空配列を返す', () => {
    const res = extractODataIndexCandidates({ filter: "invalid garbage string" });
    expect(res).toEqual([]);
  });

  it('7. 重複列が出ても最終結果は暴れない', () => {
    const res = extractODataIndexCandidates({ filter: "Status eq 'Open' and Status eq 'Closed'", orderby: "Status desc" });
    // First reason matched is captured, further instances of the same field are ignored
    expect(res).toEqual([{ field: 'Status', reason: 'comparison' }]);
  });

  it('8. substringof', () => {
    const res = extractODataIndexCandidates({ filter: "substringof('abc', Title)" });
    expect(res).toEqual([{ field: 'Title', reason: 'contains' }]);
  });
});
