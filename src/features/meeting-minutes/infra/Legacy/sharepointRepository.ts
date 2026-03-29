import { auditLog } from '@/lib/debugLogger';
import type { MeetingCategory, MeetingMinutes } from '../../types';
import type { MeetingMinutesRepository, MeetingMinutesUpdateDto, MinutesSearchParams } from '../../sp/repository';
import { MeetingMinutesFields as F, MEETING_MINUTES_LIST_TITLE } from '../../sp/sharepoint';

// NOTE: spFetch は "/lists/getbytitle('...')" などの相対パスをそのまま受け付け、
// auth token などの必要な設定を自動で付与します。
async function spJson<T>(
  spFetch: (path: string, init?: RequestInit) => Promise<Response>,
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await spFetch(url, {
    ...init,
    headers: {
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    auditLog.error('meeting-minutes', 'sp_fetch_failed', { 
      status: res.status, 
      url, 
      method: init?.method ?? 'GET',
      response: text
    });
    throw new Error(`SP error: ${res.status} - ${text}`);
  }
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

export function mapItemToMinutes(item: SpItem): MeetingMinutes {
  const id = Number(item[F.id] ?? 0);
  const meetingDate = asString(item[F.meetingDate]);
  const category = asString(item[F.category]);
  // Attendees: SP の 複数行テキスト に JSON 配列として保存
  const rawAttendees = asString(item[F.attendees]);
  let attendees: string[] = [];
  if (rawAttendees) {
    try { attendees = JSON.parse(rawAttendees) as string[]; } catch { attendees = []; }
  } else {
    attendees = asStringArray(item[F.attendees]) ?? [];
  }
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
    attendees,
    staffAttendance: asString(item[F.staffAttendance]) ?? '',
    userHealthNotes: asString(item[F.userHealthNotes]) ?? '',
    created: asString(item[F.created]),
    modified: asString(item[F.modified]),
  };
}

export const escapeODataString = (value: string): string => value.replace(/'/g, "''");

export function buildFilter(params: MinutesSearchParams): string {
  const filters: string[] = [];

  if (params.publishedOnly) {
    filters.push(`${F.isPublished} eq true`);
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

export const buildPatchBody = (patch: MeetingMinutesUpdateDto): Record<string, unknown> => {
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
  set(F.staffAttendance, patch.staffAttendance);
  set(F.userHealthNotes, patch.userHealthNotes);
  if (patch.attendees !== undefined) {
    body[F.attendees] = JSON.stringify(patch.attendees);
  }
  return body;
};

export function createSharePointMeetingMinutesRepository(
  spFetch: (path: string, init?: RequestInit) => Promise<Response>
): MeetingMinutesRepository {
  const listApiBase = `/lists/getbytitle('${MEETING_MINUTES_LIST_TITLE}')/items`;

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
        F.staffAttendance,
        F.userHealthNotes,
      ].join(',');

      const filter = buildFilter(params);
      const orderBy = `${F.meetingDate} desc, ${F.modified} desc`;

      const url =
        `${listApiBase}?$select=${encodeURIComponent(select)}` +
        (filter ? `&$filter=${encodeURIComponent(filter)}` : '') +
        `&$orderby=${encodeURIComponent(orderBy)}`;

      const data = await spJson<{ value: SpItem[] }>(spFetch, url);
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
        F.staffAttendance,
        F.userHealthNotes,
      ].join(',');
      const url = `${listApiBase}(${id})?$select=${encodeURIComponent(select)}`;
      const item = await spJson<SpItem>(spFetch, url);
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
        [F.attendees]: JSON.stringify(draft.attendees ?? []),
        [F.staffAttendance]: draft.staffAttendance ?? '',
        [F.userHealthNotes]: draft.userHealthNotes ?? '',
      };
      const created = await spJson<SpItem>(spFetch, url, { method: 'POST', body: JSON.stringify(body) });
      return Number(created.Id ?? created[F.id] ?? 0);
    },

    async update(id, patch) {
      const url = `${listApiBase}(${id})`;
      const body = buildPatchBody(patch);
      if (!Object.keys(body).length) return;

      await spJson<SpItem>(spFetch, url, {
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
