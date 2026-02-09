import type { MeetingMinutes, MeetingCategory } from '../types';
import type { MeetingMinutesRepository, MinutesSearchParams, MeetingMinutesUpdateDto } from './repository';
import { MEETING_MINUTES_LIST_TITLE, MeetingMinutesFields as F } from './sharepoint';

function normalizeApiBaseUrl(input: string): string {
  const trimmed = input.trim();
  return trimmed.endsWith('/_api/web') ? trimmed : `${trimmed.replace(/\/$/, '')}/_api/web`;
}

// NOTE: siteOrApiBaseUrl は "https://tenant.sharepoint.com/sites/xxx" も
// "https://tenant.sharepoint.com/sites/xxx/_api/web" も許容。
async function spJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`SP error: ${res.status}`);
  return (await res.json()) as T;
}

type SpItem = Record<string, unknown>;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === 'string');
};

function mapItemToMinutes(item: SpItem): MeetingMinutes {
  const id = Number(item[F.id] ?? 0);
  const meetingDate = asString(item[F.meetingDate]);
  const category = asString(item[F.category]);
  return {
    id: Number.isFinite(id) ? id : 0,
    title: asString(item[F.title]) ?? '',
    meetingDate: meetingDate?.slice(0, 10) ?? '',
    category: (category ?? '職員会議') as MeetingCategory,
    summary: asString(item[F.summary]) ?? '',
    decisions: asString(item[F.decisions]) ?? '',
    actions: asString(item[F.actions]) ?? '',
    tags: asString(item[F.tags]) ?? '',
    relatedLinks: asString(item[F.relatedLinks]) ?? '',
    isPublished: asBoolean(item[F.isPublished]) ?? true,
    chair: asString(item[F.chair]) ?? '',
    scribe: asString(item[F.scribe]) ?? '',
    attendees: asStringArray(item[F.attendees]) ?? [],
    created: asString(item[F.created]),
    modified: asString(item[F.modified]),
  };
}

const escapeODataString = (value: string): string => value.replace(/'/g, "''");

function buildFilter(params: MinutesSearchParams): string {
  const filters: string[] = [];

  if (params.publishedOnly) {
    filters.push(`${F.isPublished} eq 1`);
  }
  if (params.category && params.category !== 'ALL') {
    filters.push(`${F.category} eq '${escapeODataString(params.category)}'`);
  }
  if (params.from) {
    filters.push(`${F.meetingDate} ge '${params.from}'`);
  }
  if (params.to) {
    filters.push(`${F.meetingDate} le '${params.to}'`);
  }
  // q/tag は SharePoint の OData で完全一致/containsが厄介なため、MVPはクライアント側で処理。
  return filters.join(' and ');
}

const buildPatchBody = (patch: MeetingMinutesUpdateDto): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  const set = (field: string, value: unknown) => {
    if (value !== undefined) body[field] = value;
  };

  set(F.title, patch.title);
  set(F.meetingDate, patch.meetingDate);
  set(F.category, patch.category);
  set(F.summary, patch.summary);
  set(F.decisions, patch.decisions);
  set(F.actions, patch.actions);
  set(F.tags, patch.tags);
  set(F.relatedLinks, patch.relatedLinks);
  set(F.isPublished, patch.isPublished);
  set(F.chair, patch.chair);
  set(F.scribe, patch.scribe);
  return body;
};

export function createSharePointMeetingMinutesRepository(siteOrApiBaseUrl: string): MeetingMinutesRepository {
  const apiBaseUrl = normalizeApiBaseUrl(siteOrApiBaseUrl);
  const listApiBase = `${apiBaseUrl}/lists/getbytitle('${MEETING_MINUTES_LIST_TITLE}')/items`;

  return {
    async list(params) {
      const select = [
        F.id,
        F.title,
        F.created,
        F.modified,
        F.meetingDate,
        F.category,
        F.summary,
        F.decisions,
        F.actions,
        F.tags,
        F.relatedLinks,
        F.isPublished,
        F.chair,
        F.scribe,
        F.attendees,
      ].join(',');

      const filter = buildFilter(params);
      const orderBy = `${F.meetingDate} desc, ${F.modified} desc`;

      const url =
        `${listApiBase}?$select=${encodeURIComponent(select)}` +
        (filter ? `&$filter=${encodeURIComponent(filter)}` : '') +
        `&$orderby=${encodeURIComponent(orderBy)}`;

      const data = await spJson<{ value: SpItem[] }>(url);
      let rows = (data.value ?? []).map(mapItemToMinutes);

      const q = (params.q ?? '').trim();
      const tag = (params.tag ?? '').trim();
      if (q) {
        const qq = q.toLowerCase();
        rows = rows.filter((r) =>
          (r.title ?? '').toLowerCase().includes(qq) ||
          (r.summary ?? '').toLowerCase().includes(qq) ||
          (r.tags ?? '').toLowerCase().includes(qq)
        );
      }
      if (tag) {
        const tt = tag.toLowerCase();
        rows = rows.filter((r) => (r.tags ?? '').toLowerCase().includes(tt));
      }

      return rows;
    },

    async getById(id) {
      const select = [
        F.id,
        F.title,
        F.created,
        F.modified,
        F.meetingDate,
        F.category,
        F.summary,
        F.decisions,
        F.actions,
        F.tags,
        F.relatedLinks,
        F.isPublished,
        F.chair,
        F.scribe,
        F.attendees,
      ].join(',');
      const url = `${listApiBase}(${id})?$select=${encodeURIComponent(select)}`;
      const item = await spJson<SpItem>(url);
      return mapItemToMinutes(item);
    },

    async create(draft) {
      const url = `${listApiBase}`;
      const body: Record<string, unknown> = {
        [F.title]: draft.title,
        [F.meetingDate]: draft.meetingDate,
        [F.category]: draft.category,
        [F.summary]: draft.summary,
        [F.decisions]: draft.decisions,
        [F.actions]: draft.actions,
        [F.tags]: draft.tags,
        [F.relatedLinks]: draft.relatedLinks,
        [F.isPublished]: draft.isPublished ?? true,
        [F.chair]: draft.chair ?? '',
        [F.scribe]: draft.scribe ?? '',
        // Attendees: Person multi を使う場合は ID 配列を送る必要あり（MVPは省略）。
      };
      const created = await spJson<SpItem>(url, { method: 'POST', body: JSON.stringify(body) });
      return Number(created.Id ?? created[F.id] ?? 0);
    },

    async update(id, patch) {
      const url = `${listApiBase}(${id})`;
      const body = buildPatchBody(patch);
      if (!Object.keys(body).length) return;

      await spJson<SpItem>(url, {
        method: 'POST',
        headers: {
          'X-HTTP-Method': 'MERGE',
          'IF-MATCH': '*',
        },
        body: JSON.stringify(body),
      });
    },
  };
}
