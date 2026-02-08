/**
 * Meeting Data Types for朝会・夕会 System
 *
 * Phase 4C: External Data 布石
 *
 * Defines type-safe data structures for meeting session persistence,
 * following established SharePoint integration patterns from:
 * - Monthly Records (src/features/records/monthly/map.ts)
 * - Legacy schedule events (removed in Phase 2-C)
 * - Audit Records (src/features/audit/types.ts)
 */

import type { MeetingKind, MeetingStepId } from './meetingSteps';

// Re-export types for external use
export type { MeetingKind, MeetingStepId };

// ──────────────────────────────────────────────────────────────
// Core Meeting Data Types
// ──────────────────────────────────────────────────────────────

export type MeetingSessionStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'remote' | 'absent';
export type ParticipantRole = 'chairperson' | 'staff' | 'observer' | 'trainee';

/**
 * Complete meeting session record
 * Used for display and business logic
 */
export interface MeetingSession {
  id?: number; // SharePoint Id (undefined for new records)
  sessionKey: string; // Unique identifier: {date}#{kind} (e.g., "2024-11-18#morning")
  meetingKind: MeetingKind;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (actual start time)
  endTime?: string; // HH:MM (actual end time)
  chairpersonUserId: string; // Staff ID who led the meeting
  chairpersonName: string; // Staff display name
  status: MeetingSessionStatus;
  totalParticipants: number; // Count of participants
  completedSteps: number; // Count of completed steps
  totalSteps: number; // Total steps for this meeting kind
  sessionNotes?: string; // General meeting notes
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  // Calculated fields
  completionRate: number; // completedSteps / totalSteps * 100
  durationMinutes?: number; // Calculated from start/end times
}

/**
 * Individual step completion within a meeting session
 */
export interface MeetingStepRecord {
  id?: number; // SharePoint Id
  sessionId: number; // Foreign key to MeetingSession
  sessionKey: string; // Denormalized for faster queries
  stepId: MeetingStepId; // Step template ID from meetingSteps.ts
  stepTitle: string; // Step display title (denormalized)
  completed: boolean;
  completedAt?: string; // ISO datetime when step was completed
  completedByUserId?: string; // Staff who completed the step
  timeSpentMinutes: number; // Time spent on this step
  stepNotes?: string; // Optional notes for this step
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/**
 * Meeting participation record
 */
export interface MeetingParticipation {
  id?: number; // SharePoint Id
  sessionId: number; // Foreign key to MeetingSession
  sessionKey: string; // Denormalized for faster queries
  participantUserId: string; // Staff user ID
  participantName: string; // Staff display name (denormalized)
  role: ParticipantRole;
  attendanceStatus: AttendanceStatus;
  joinTime?: string; // ISO datetime when participant joined
  leaveTime?: string; // ISO datetime when participant left
  notes?: string; // Participation-specific notes
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/**
 * Priority user follow-up record within meeting session
 */
export interface MeetingPriorityRecord {
  id?: number; // SharePoint Id
  sessionId: number; // Foreign key to MeetingSession
  sessionKey: string; // Denormalized for faster queries
  userId: string; // Target user ID (service user, not staff)
  userName: string; // User display name (denormalized)
  priority: 'high' | 'medium' | 'low';
  followUpReason: string; // Why this user needs follow-up
  discussionNotes?: string; // What was discussed about this user
  actionItems?: string; // Specific actions decided
  assignedStaffId?: string; // Staff assigned to follow up
  followUpDeadline?: string; // YYYY-MM-DD for follow-up actions
  resolved: boolean; // Whether the priority concern was resolved
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

// ──────────────────────────────────────────────────────────────
// SharePoint Field Mapping Types
// ──────────────────────────────────────────────────────────────

/**
 * MeetingSessions SharePoint list item structure
 * Maps to SharePoint field types following established patterns
 */
export interface SpMeetingSessionItem {
  Id?: number; // SharePoint built-in
  Title: string; // SharePoint built-in - formatted as "{date} {kind} meeting"
  SessionKey: string; // Single line of text - unique identifier
  MeetingKind: string; // Choice field: morning|evening
  Date: string; // Date field - YYYY-MM-DD
  StartTime?: string; // Single line of text - HH:MM
  EndTime?: string; // Single line of text - HH:MM
  ChairpersonUserId: string; // Single line of text - Staff ID
  ChairpersonName: string; // Single line of text - Staff display name
  Status: string; // Choice field: scheduled|in-progress|completed|cancelled
  TotalParticipants: number; // Number field
  CompletedSteps: number; // Number field
  TotalSteps: number; // Number field
  CompletionRate: number; // Number field (percentage)
  DurationMinutes?: number; // Number field
  SessionNotes?: string; // Multiple lines of text
  Created: string; // SharePoint built-in
  Modified: string; // SharePoint built-in
  '@odata.etag'?: string; // SharePoint built-in for optimistic concurrency
}

/**
 * MeetingStepRecords SharePoint list item structure
 */
export interface SpMeetingStepItem {
  Id?: number;
  Title: string; // Formatted as "{sessionKey} - Step {stepId}"
  SessionId: number; // Number field - lookup to MeetingSessions
  SessionKey: string; // Single line of text - for faster queries
  StepId: number; // Number field - step template ID
  StepTitle: string; // Single line of text - step display title
  Completed: boolean; // Yes/No field
  CompletedAt?: string; // DateTime field
  CompletedByUserId?: string; // Single line of text - Staff ID
  TimeSpentMinutes: number; // Number field
  StepNotes?: string; // Multiple lines of text
  Created: string;
  Modified: string;
  '@odata.etag'?: string;
}

/**
 * MeetingParticipation SharePoint list item structure
 */
export interface SpMeetingParticipationItem {
  Id?: number;
  Title: string; // Formatted as "{participantName} - {sessionKey}"
  SessionId: number; // Number field - lookup to MeetingSessions
  SessionKey: string; // Single line of text
  ParticipantUserId: string; // Single line of text - Staff ID
  ParticipantName: string; // Single line of text
  Role: string; // Choice field: chairperson|staff|observer|trainee
  AttendanceStatus: string; // Choice field: present|remote|absent
  JoinTime?: string; // DateTime field
  LeaveTime?: string; // DateTime field
  Notes?: string; // Multiple lines of text
  Created: string;
  Modified: string;
  '@odata.etag'?: string;
}

/**
 * MeetingPriorityRecords SharePoint list item structure
 */
export interface SpMeetingPriorityItem {
  Id?: number;
  Title: string; // Formatted as "{userName} priority - {sessionKey}"
  SessionId: number; // Number field - lookup to MeetingSessions
  SessionKey: string; // Single line of text
  UserId: string; // Single line of text - Service user ID
  UserName: string; // Single line of text - Service user display name
  Priority: string; // Choice field: high|medium|low
  FollowUpReason: string; // Multiple lines of text
  DiscussionNotes?: string; // Multiple lines of text
  ActionItems?: string; // Multiple lines of text
  AssignedStaffId?: string; // Single line of text - Staff ID
  FollowUpDeadline?: string; // Date field
  Resolved: boolean; // Yes/No field
  Created: string;
  Modified: string;
  '@odata.etag'?: string;
}

// ──────────────────────────────────────────────────────────────
// Data Transformation Functions
// ──────────────────────────────────────────────────────────────

/**
 * Convert domain MeetingSession to SharePoint fields
 * Following patterns from monthly records and schedules
 */
export function toSpMeetingSessionFields(session: MeetingSession): Omit<SpMeetingSessionItem, 'Id' | 'Created' | 'Modified' | '@odata.etag'> {
  const formatTitle = (date: string, kind: MeetingKind) => {
    const kindLabel = kind === 'morning' ? '朝会' : '夕会';
    return `${date} ${kindLabel}`;
  };

  return {
    Title: formatTitle(session.date, session.meetingKind),
    SessionKey: session.sessionKey,
    MeetingKind: session.meetingKind,
    Date: session.date,
    StartTime: session.startTime,
    EndTime: session.endTime,
    ChairpersonUserId: session.chairpersonUserId,
    ChairpersonName: session.chairpersonName,
    Status: session.status,
    TotalParticipants: session.totalParticipants,
    CompletedSteps: session.completedSteps,
    TotalSteps: session.totalSteps,
    CompletionRate: session.completionRate,
    DurationMinutes: session.durationMinutes,
    SessionNotes: session.sessionNotes,
  };
}

/**
 * Convert SharePoint item to domain MeetingSession
 */
export function fromSpMeetingSessionFields(item: SpMeetingSessionItem): MeetingSession {
  return {
    id: item.Id,
    sessionKey: item.SessionKey,
    meetingKind: item.MeetingKind as MeetingKind,
    date: item.Date,
    startTime: item.StartTime,
    endTime: item.EndTime,
    chairpersonUserId: item.ChairpersonUserId,
    chairpersonName: item.ChairpersonName,
    status: item.Status as MeetingSessionStatus,
    totalParticipants: item.TotalParticipants,
    completedSteps: item.CompletedSteps,
    totalSteps: item.TotalSteps,
    completionRate: item.CompletionRate,
    durationMinutes: item.DurationMinutes,
    sessionNotes: item.SessionNotes,
    createdAt: item.Created,
    updatedAt: item.Modified,
  };
}

/**
 * Convert domain MeetingStepRecord to SharePoint fields
 */
export function toSpMeetingStepFields(step: MeetingStepRecord): Omit<SpMeetingStepItem, 'Id' | 'Created' | 'Modified' | '@odata.etag'> {
  return {
    Title: `${step.sessionKey} - Step ${step.stepId}`,
    SessionId: step.sessionId,
    SessionKey: step.sessionKey,
    StepId: step.stepId,
    StepTitle: step.stepTitle,
    Completed: step.completed,
    CompletedAt: step.completedAt,
    CompletedByUserId: step.completedByUserId,
    TimeSpentMinutes: step.timeSpentMinutes,
    StepNotes: step.stepNotes,
  };
}

/**
 * Convert SharePoint item to domain MeetingStepRecord
 */
export function fromSpMeetingStepFields(item: SpMeetingStepItem): MeetingStepRecord {
  return {
    id: item.Id,
    sessionId: item.SessionId,
    sessionKey: item.SessionKey,
    stepId: item.StepId as MeetingStepId,
    stepTitle: item.StepTitle,
    completed: item.Completed,
    completedAt: item.CompletedAt,
    completedByUserId: item.CompletedByUserId,
    timeSpentMinutes: item.TimeSpentMinutes,
    stepNotes: item.StepNotes,
    createdAt: item.Created,
    updatedAt: item.Modified,
  };
}

// Similar transformation functions for participation and priority records...

/**
 * Generate idempotency key for meeting sessions
 * Following pattern from monthly records
 */
export function generateMeetingSessionKey(date: string, kind: MeetingKind): string {
  return `${date}#${kind}`;
}

/**
 * Build OData filter for meeting sessions by date range
 */
export function buildMeetingSessionFilter(options: {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  meetingKind?: MeetingKind;
  status?: MeetingSessionStatus;
  chairpersonUserId?: string;
}): string {
  const filters: string[] = [];

  if (options.dateFrom) {
    filters.push(`Date ge '${options.dateFrom}'`);
  }

  if (options.dateTo) {
    filters.push(`Date le '${options.dateTo}'`);
  }

  if (options.meetingKind) {
    filters.push(`MeetingKind eq '${options.meetingKind}'`);
  }

  if (options.status) {
    filters.push(`Status eq '${options.status}'`);
  }

  if (options.chairpersonUserId) {
    filters.push(`ChairpersonUserId eq '${options.chairpersonUserId}'`);
  }

  return filters.length > 0 ? `$filter=${filters.join(' and ')}` : '';
}

/**
 * Build OData filter for meeting steps by session
 */
export function buildMeetingStepsFilter(sessionId: number): string {
  return `$filter=SessionId eq ${sessionId}`;
}

/**
 * Default SharePoint list names for meeting data
 * Following naming conventions from existing lists
 */
export const MEETING_LIST_NAMES = {
  SESSIONS: 'MeetingSessions',
  STEPS: 'MeetingStepRecords',
  PARTICIPATION: 'MeetingParticipation',
  PRIORITY_RECORDS: 'MeetingPriorityRecords',
} as const;

/**
 * SharePoint field select clauses for each list
 * Following patterns from schedules and other entities
 */
export const MEETING_SELECT_FIELDS = {
  SESSIONS: [
    'Id', 'Title', 'SessionKey', 'MeetingKind', 'Date',
    'StartTime', 'EndTime', 'ChairpersonUserId', 'ChairpersonName',
    'Status', 'TotalParticipants', 'CompletedSteps', 'TotalSteps',
    'CompletionRate', 'DurationMinutes', 'SessionNotes',
    'Created', 'Modified', '@odata.etag'
  ].join(','),

  STEPS: [
    'Id', 'Title', 'SessionId', 'SessionKey', 'StepId', 'StepTitle',
    'Completed', 'CompletedAt', 'CompletedByUserId', 'TimeSpentMinutes',
    'StepNotes', 'Created', 'Modified', '@odata.etag'
  ].join(','),

  PARTICIPATION: [
    'Id', 'Title', 'SessionId', 'SessionKey', 'ParticipantUserId',
    'ParticipantName', 'Role', 'AttendanceStatus', 'JoinTime',
    'LeaveTime', 'Notes', 'Created', 'Modified', '@odata.etag'
  ].join(','),

  PRIORITY_RECORDS: [
    'Id', 'Title', 'SessionId', 'SessionKey', 'UserId', 'UserName',
    'Priority', 'FollowUpReason', 'DiscussionNotes', 'ActionItems',
    'AssignedStaffId', 'FollowUpDeadline', 'Resolved',
    'Created', 'Modified', '@odata.etag'
  ].join(','),
} as const;