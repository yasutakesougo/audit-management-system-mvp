/**
 * SharePoint フィールド定義 — MeetingMinutes
 */

export const MEETING_MINUTES_LIST_TITLE = 'MeetingMinutes' as const;

export const MEETING_MINUTES_FIELDS = {
  id: 'Id',
  title: 'Title',
  meetingDate: 'MeetingDate',
  category: 'Category',
  summary: 'Summary',
  decisions: 'Decisions',
  actions: 'Actions',
  tags: 'Tags',
  relatedLinks: 'RelatedLinks',
  isPublished: 'IsPublished',
  chair: 'Chair',
  scribe: 'Scribe',
  attendees: 'Attendees',
  staffAttendance: 'StaffAttendance',
  userHealthNotes: 'UserHealthNotes',
  created: 'Created',
  modified: 'Modified',
} as const;

export const MEETING_MINUTES_SELECT_FIELDS = [
  MEETING_MINUTES_FIELDS.id,
  MEETING_MINUTES_FIELDS.title,
  MEETING_MINUTES_FIELDS.meetingDate,
  MEETING_MINUTES_FIELDS.category,
  MEETING_MINUTES_FIELDS.summary,
  MEETING_MINUTES_FIELDS.decisions,
  MEETING_MINUTES_FIELDS.actions,
  MEETING_MINUTES_FIELDS.tags,
  MEETING_MINUTES_FIELDS.relatedLinks,
  MEETING_MINUTES_FIELDS.isPublished,
  MEETING_MINUTES_FIELDS.chair,
  MEETING_MINUTES_FIELDS.scribe,
  MEETING_MINUTES_FIELDS.attendees,
  MEETING_MINUTES_FIELDS.staffAttendance,
  MEETING_MINUTES_FIELDS.userHealthNotes,
  MEETING_MINUTES_FIELDS.created,
  MEETING_MINUTES_FIELDS.modified,
] as const;

/**
 * 0. MeetingMinutes リストのフィールド候補
 */
export const MEETING_MINUTES_CANDIDATES = {
  meetingDate:     ['MeetingDate', 'meetingDate', 'cr013_meetingDate', 'Date'],
  category:        ['Category', 'category', 'cr013_category', 'MeetingCategory'],
  summary:         ['Summary', 'summary', 'cr013_summary', 'Notes'],
  decisions:       ['Decisions', 'decisions', 'cr013_decisions', 'DecisionSummary'],
  actions:         ['Actions', 'actions', 'cr013_actions', 'ActionItems'],
  attendees:       ['Attendees', 'attendees', 'cr013_attendees'],
  staffAttendance: ['StaffAttendance', 'staffAttendance', 'cr013_staffAttendance'],
  isPublished:     ['IsPublished', 'isPublished', 'cr013_isPublished', 'Published'],
} as const;

export const MEETING_MINUTES_ESSENTIALS: (keyof typeof MEETING_MINUTES_CANDIDATES)[] = [
  'meetingDate', 'category'
];
