import { auditLog } from '@/lib/debugLogger';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import type { MeetingMinutes, MeetingCategory } from '../types';
import type { MeetingMinutesRepository, MinutesSearchParams, MeetingMinutesCreateDto, MeetingMinutesUpdateDto } from '../sp/repository';
import { MeetingMinutesFields as F, MEETING_MINUTES_LIST_TITLE } from '../sp/sharepoint';
import { buildEq, buildGe, buildLe, joinAnd } from '@/sharepoint/query/builders';

/**
 * DataProviderMeetingMinutesRepository
 *
 * IDataProvider ベースの MeetingMinutesRepository 実装。
 * 職員会議記録の CRUD を担当する。
 */
export class DataProviderMeetingMinutesRepository implements MeetingMinutesRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;

  constructor(provider: IDataProvider, listTitle: string = MEETING_MINUTES_LIST_TITLE) {
    this.provider = provider;
    this.listTitle = listTitle;
  }

  async list(params: MinutesSearchParams): Promise<MeetingMinutes[]> {
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
    ];

    const filter = this.buildFilter(params);
    const orderBy = `${F.meetingDate} desc, ${F.modified} desc`;

    try {
      const rows = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        select,
        filter: filter || undefined,
        orderby: orderBy,
      });

      let items = rows.map(r => this.mapRowToMinutes(r));

      // クライアント側検索 (q / tag)
      const q = (params.q ?? '').trim().toLowerCase();
      const tag = (params.tag ?? '').trim().toLowerCase();

      if (q) {
        items = items.filter((r) =>
          (r.title ?? '').toLowerCase().includes(q) ||
          (r.summary ?? '').toLowerCase().includes(q) ||
          (r.tags ?? '').toLowerCase().includes(q)
        );
      }
      if (tag) {
        items = items.filter((r) => (r.tags ?? '').toLowerCase().includes(tag));
      }

      return items;
    } catch (err) {
      auditLog.error('meeting-minutes', 'Failed to list meeting minutes', err);
      return [];
    }
  }

  async getById(id: number): Promise<MeetingMinutes> {
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
    ];

    try {
      const item = await this.provider.getItemById<Record<string, unknown>>(this.listTitle, id, { select });
      return this.mapRowToMinutes(item);
    } catch (err) {
      auditLog.error('meeting-minutes', `Failed to get meeting minutes by id: ${id}`, err);
      throw err;
    }
  }

  async create(draft: MeetingMinutesCreateDto): Promise<number> {
    const body = this.buildPatchBody(draft);
    try {
      const created = await this.provider.createItem<Record<string, unknown>>(this.listTitle, body);
      return Number(created.Id ?? created[F.id] ?? 0);
    } catch (err) {
      auditLog.error('meeting-minutes', 'Failed to create meeting minutes', err);
      throw err;
    }
  }

  async update(id: number, patch: MeetingMinutesUpdateDto): Promise<void> {
    const body = this.buildPatchBody(patch);
    if (Object.keys(body).length === 0) return;

    try {
      await this.provider.updateItem(this.listTitle, id, body, { etag: '*' });
    } catch (err) {
      auditLog.error('meeting-minutes', `Failed to update meeting minutes: ${id}`, err);
      throw err;
    }
  }

  private mapRowToMinutes(item: Record<string, unknown>): MeetingMinutes {
    const id = Number(item[F.id] ?? 0);
    const meetingDate = item[F.meetingDate] as string | undefined;
    const category = item[F.category] as string | undefined;
    
    // Attendees: JSON string fallback
    const rawAttendees = item[F.attendees] as string | undefined;
    let attendees: string[] = [];
    if (rawAttendees) {
      try {
        const parsed = JSON.parse(rawAttendees);
        attendees = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        attendees = [];
      }
    }

    return {
      id: Number.isFinite(id) ? id : 0,
      title: (item[F.title] as string) ?? '',
      meetingDate: meetingDate?.slice(0, 10) ?? '',
      category: (category ?? '職員会議') as MeetingCategory,
      summary: (item[F.summary] as string) ?? '',
      decisions: (item[F.decisions] as string) ?? '',
      actions: (item[F.actions] as string) ?? '',
      tags: (item[F.tags] as string) ?? '',
      relatedLinks: (item[F.relatedLinks] as string) ?? '',
      isPublished: !!item[F.isPublished],
      chair: (item[F.chair] as string) ?? '',
      scribe: (item[F.scribe] as string) ?? '',
      attendees,
      staffAttendance: (item[F.staffAttendance] as string) ?? '',
      userHealthNotes: (item[F.userHealthNotes] as string) ?? '',
      created: typeof item[F.created] === 'string' ? (item[F.created] as string) : undefined,
      modified: typeof item[F.modified] === 'string' ? (item[F.modified] as string) : undefined,
    };
  }

  private buildFilter(params: MinutesSearchParams): string {
    const filters: (string | undefined)[] = [];

    if (params.publishedOnly) {
      filters.push(buildEq(F.isPublished, true));
    }
    if (params.category && params.category !== 'ALL') {
      filters.push(buildEq(F.category, params.category));
    }
    if (params.from) {
      filters.push(buildGe(F.meetingDate, params.from));
    }
    if (params.to) {
      filters.push(buildLe(F.meetingDate, params.to));
    }
    return joinAnd(filters);
  }

  private buildPatchBody(patch: MeetingMinutesUpdateDto): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    const keys: (keyof typeof F)[] = [
      'title', 'meetingDate', 'category', 'summary', 'decisions', 
      'actions', 'tags', 'relatedLinks', 'isPublished', 
      'chair', 'scribe', 'staffAttendance', 'userHealthNotes'
    ];

    keys.forEach(k => {
      const spKey = F[k];
      const val = (patch as Record<string, unknown>)[k];
      if (val !== undefined) body[spKey] = val;
    });

    if (patch.attendees !== undefined) {
      body[F.attendees] = JSON.stringify(patch.attendees);
    }

    return body;
  }
}
