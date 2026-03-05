/**
 * localStorageRepository — ローカル開発用の MeetingMinutesRepository 実装
 *
 * SharePoint が利用できないローカル環境で議事録機能を動作確認できるよう、
 * localStorage にデータを保存するフォールバック実装。
 */
import type { MeetingMinutes } from '../types';
import type {
    MeetingMinutesCreateDto,
    MeetingMinutesRepository,
    MeetingMinutesUpdateDto,
    MinutesSearchParams,
} from './repository';

const STORAGE_KEY = 'meeting-minutes-local';

function readAll(): MeetingMinutes[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MeetingMinutes[];
  } catch {
    return [];
  }
}

function writeAll(items: MeetingMinutes[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function nextId(items: MeetingMinutes[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.id)) + 1;
}

function matchesSearch(item: MeetingMinutes, params: MinutesSearchParams): boolean {
  if (params.publishedOnly && item.isPublished === false) return false;

  if (params.category && params.category !== 'ALL') {
    if (item.category !== params.category) return false;
  }

  if (params.from && item.meetingDate < params.from) return false;
  if (params.to && item.meetingDate > params.to) return false;

  const q = (params.q ?? '').trim().toLowerCase();
  if (q) {
    const haystack = [item.title, item.summary, item.tags].join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  const tag = (params.tag ?? '').trim().toLowerCase();
  if (tag) {
    if (!(item.tags ?? '').toLowerCase().includes(tag)) return false;
  }

  return true;
}

export function createLocalStorageMeetingMinutesRepository(): MeetingMinutesRepository {
  return {
    async list(params) {
      const all = readAll();
      const filtered = all.filter((item) => matchesSearch(item, params));
      // Sort by meetingDate desc, then modified desc
      filtered.sort((a, b) => {
        const dateCmp = (b.meetingDate ?? '').localeCompare(a.meetingDate ?? '');
        if (dateCmp !== 0) return dateCmp;
        return (b.modified ?? '').localeCompare(a.modified ?? '');
      });
      return filtered;
    },

    async getById(id) {
      const all = readAll();
      const found = all.find((item) => item.id === id);
      if (!found) throw new Error(`MeetingMinutes #${id} not found`);
      return found;
    },

    async create(draft: MeetingMinutesCreateDto) {
      const all = readAll();
      const id = nextId(all);
      const now = new Date().toISOString();
      const item: MeetingMinutes = {
        ...draft,
        id,
        created: now,
        modified: now,
      };
      all.unshift(item);
      writeAll(all);
      return id;
    },

    async update(id, patch: MeetingMinutesUpdateDto) {
      const all = readAll();
      const idx = all.findIndex((item) => item.id === id);
      if (idx === -1) throw new Error(`MeetingMinutes #${id} not found`);
      const now = new Date().toISOString();
      all[idx] = { ...all[idx], ...patch, modified: now };
      writeAll(all);
    },
  };
}
