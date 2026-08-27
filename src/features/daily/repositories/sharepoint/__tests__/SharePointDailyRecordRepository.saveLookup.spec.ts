import { describe, expect, it, vi } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { SharePointDailyRecordRepository } from '../SharePointDailyRecordRepository';
import type { SaveDailyRecordInput } from '../../../domain/legacy/DailyRecordRepository';

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const jsonResponseWithEtag = (value: unknown, etag: string, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ETag: etag },
  });

const isParentCommitSnapshotRead = (url: string, init?: RequestInit): boolean => {
  const headers = init?.headers as Record<string, string> | undefined;
  if (headers?.['X-HTTP-Method']) return false;
  if (init?.method === 'POST') return false;
  return url.includes('SupportRecord_Daily') &&
    url.includes('items(') &&
    (url.includes('$select') || url.includes('%24select'));
};

const sampleInput = (): SaveDailyRecordInput => ({
  date: '2026-08-27',
  reporter: { name: 'Staff', role: 'Staff' },
  userRows: [
    {
      userId: 'U001',
      userName: 'U001',
      amActivity: '',
      pmActivity: '',
      lunchAmount: '',
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false,
      },
      specialNotes: '',
      behaviorTags: [],
    },
  ],
  userCount: 1,
});

/** Parent date lookup uses $filter+$select; URLSearchParams encodes `$` as `%24`. */
const isParentLookup = (url: string): boolean =>
  url.includes('/items?') &&
  (url.includes('%24filter') || url.includes('$filter')) &&
  (url.includes('LatestCommitId') || url.includes('%2CLatestCommitId'));

const countMutations = (spFetch: ReturnType<typeof vi.fn<SpFetchFn>>) => {
  let parentPosts = 0;
  let childPosts = 0;
  let parentMerges = 0;

  for (const call of spFetch.mock.calls) {
    const url = String(call[0]);
    const init = call[1] as RequestInit | undefined;
    const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];
    if (init?.method !== 'POST') continue;
    if (httpMethod === 'MERGE') {
      parentMerges += 1;
      continue;
    }
    if (httpMethod === 'DELETE') continue;
    if (url.includes('DailyRecordRows') && url.includes('/items') && !url.includes('items(')) {
      childPosts += 1;
      continue;
    }
    if (url.includes('SupportRecord_Daily') && url.endsWith('/items')) {
      parentPosts += 1;
    }
  }

  return { parentPosts, childPosts, parentMerges };
};

describe('SharePointDailyRecordRepository save parent-lookup abort', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_E2E', '1');
  });

  it('1. parent lookup network failure aborts with Parent POST=0 and Child POST=0', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      if (isParentLookup(String(url))) {
        throw new Error('network down during parent lookup');
      }
      return jsonResponse({ value: [] });
    });

    const repo = new SharePointDailyRecordRepository({
      spFetch,
      listTitle: 'SupportRecord_Daily',
    });

    await expect(repo.save(sampleInput())).rejects.toThrow(/network down during parent lookup/);
    expect(countMutations(spFetch)).toEqual({ parentPosts: 0, childPosts: 0, parentMerges: 0 });
  });

  it('2. parent lookup HTTP 403/500 aborts with no mutation', async () => {
    for (const status of [403, 500]) {
      const spFetch = vi.fn<SpFetchFn>(async (url) => {
        if (isParentLookup(String(url))) {
          return new Response('forbidden', { status, headers: { 'Content-Type': 'text/plain' } });
        }
        return jsonResponse({ value: [] });
      });

      const repo = new SharePointDailyRecordRepository({
        spFetch,
        listTitle: 'SupportRecord_Daily',
      });

      await expect(repo.save(sampleInput())).rejects.toThrow(
        new RegExp(`Parent lookup failed with HTTP ${status}`),
      );
      expect(countMutations(spFetch)).toEqual({ parentPosts: 0, childPosts: 0, parentMerges: 0 });
    }
  });

  it('3. LatestCommitId schema-missing lookup (HTTP 400) aborts and does not create Parent', async () => {
    const spFetch = vi.fn<SpFetchFn>(async (url) => {
      if (isParentLookup(String(url))) {
        expect(String(url)).toMatch(/LatestCommitId/);
        return new Response("The field 'LatestCommitId' does not exist.", {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return jsonResponse({ value: [] });
    });

    const repo = new SharePointDailyRecordRepository({
      spFetch,
      listTitle: 'SupportRecord_Daily',
    });

    await expect(repo.save(sampleInput())).rejects.toThrow(/Parent lookup failed with HTTP 400/);
    expect(countMutations(spFetch)).toEqual({ parentPosts: 0, childPosts: 0, parentMerges: 0 });
  });

  it('4. HTTP 200 + value=[] is the only gate that allows new Parent creation', async () => {
    let parentLookupCount = 0;
    const spFetch = vi.fn<SpFetchFn>(async (url, init) => {
      const target = String(url);
      const httpMethod = (init?.headers as Record<string, string> | undefined)?.['X-HTTP-Method'];

      if (isParentLookup(target)) {
        parentLookupCount += 1;
        if (parentLookupCount <= 2) {
          return jsonResponse({ value: [] });
        }
        return jsonResponse({ value: [{ Id: 90 }] });
      }
      if (target.includes('SupportRecord_Daily') && target.endsWith('/items') && init?.method === 'POST' && !httpMethod) {
        return jsonResponse({ Id: 90 });
      }
      if (isParentCommitSnapshotRead(target, init)) {
        return jsonResponseWithEtag({ Id: 90, LatestVersion: 0 }, '"etag-90"');
      }
      if (target.includes('DailyRecordRows') && target.includes('/items') && init?.method === 'POST' && !httpMethod) {
        return jsonResponse({ Id: 901 });
      }
      if (target.includes('items(90)') && httpMethod === 'MERGE') {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ value: [] });
    });

    const repo = new SharePointDailyRecordRepository({
      spFetch,
      listTitle: 'SupportRecord_Daily',
    });

    await repo.save(sampleInput());
    expect(countMutations(spFetch)).toEqual({ parentPosts: 1, childPosts: 1, parentMerges: 1 });
  });
});
