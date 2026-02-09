import type { MeetingMinutes, MeetingCategory } from '../types';

export type MinutesSearchParams = {
  q?: string;
  tag?: string;
  category?: MeetingCategory | 'ALL';
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  publishedOnly?: boolean;
};

export type MeetingMinutesCreateDto = Omit<MeetingMinutes, 'id'>;
export type MeetingMinutesUpdateDto = Partial<Omit<MeetingMinutes, 'id'>>;

export interface MeetingMinutesRepository {
  list(params: MinutesSearchParams): Promise<MeetingMinutes[]>;
  getById(id: number): Promise<MeetingMinutes>;
  create(draft: MeetingMinutesCreateDto): Promise<number>;
  update(id: number, patch: MeetingMinutesUpdateDto): Promise<void>;
}
