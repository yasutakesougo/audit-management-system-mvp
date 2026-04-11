/**
 * SharePoint フィールド定義 — MeetingSessions (会議セッション)
 */
export const MEETING_SESSIONS_LIST_TITLE = 'MeetingSessions' as const;

export const MEETING_SESSIONS_FIELDS = {
  id: 'Id',
  title: 'Title',
  sessionKey: 'SessionKey',
  meetingKind: 'MeetingKind',
  date: 'Date',
  startTime: 'StartTime',
  endTime: 'EndTime',
  chairpersonUserId: 'ChairpersonUserId',
  chairpersonName: 'ChairpersonName',
  status: 'Status',
  totalParticipants: 'TotalParticipants',
  completedSteps: 'CompletedSteps',
  totalSteps: 'TotalSteps',
  completionRate: 'CompletionRate',
  durationMinutes: 'DurationMinutes',
  sessionNotes: 'SessionNotes',
  created: 'Created',
  modified: 'Modified',
} as const;

/**
 * 0. MeetingSessions リストのフィールド候補 (Drift Resistance)
 */
export const MEETING_SESSIONS_CANDIDATES = {
  sessionKey:        ['Session_x0020_Key', 'SessionKey', 'sessionKey', 'cr013_sessionKey', 'Key'],
  meetingKind:       ['Meeting_x0020_Kind', 'MeetingKind', 'meetingKind', 'cr013_meetingKind', 'Kind'],
  date:              ['Meeting_x0020_Date', 'Date', 'date', 'cr013_date', 'MeetingDate'],
  startTime:         ['Start_x0020_Time', 'StartTime', 'startTime'],
  endTime:           ['End_x0020_Time', 'EndTime', 'endTime'],
  status:            ['Status', 'status', 'cr013_status'],
  chairpersonUserId: ['Chairperson_x0020_ID', 'ChairpersonUserId', 'chairpersonUserId', 'cr013_chairpersonUserId', 'ChairpersonID'],
  chairpersonName:   ['Chairperson_x0020_Name', 'ChairpersonName', 'chairpersonName', 'cr013_chairpersonName', 'ChairPerson'],
  totalParticipants: ['Total_x0020_Participants', 'TotalParticipants', 'totalParticipants', 'cr013_totalParticipants', 'ParticipantsCount'],
} as const;

export const MEETING_SESSIONS_ESSENTIALS: (keyof typeof MEETING_SESSIONS_CANDIDATES)[] = [
  'sessionKey', 'meetingKind', 'date'
];

/**
 * 2. Provisioning Definition (spListRegistry.ts 等で使用)
 */
export const MEETING_SESSIONS_SELECT_FIELDS = Object.values(MEETING_SESSIONS_FIELDS);
