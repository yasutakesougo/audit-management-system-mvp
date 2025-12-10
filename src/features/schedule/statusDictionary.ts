import { SCHEDULE_STATUSES, type Status } from './types';

export const STATUS_DEFAULT: Status = '下書き';

export const STATUS_LABELS: Record<Status, string> = Object.freeze({
  下書き: '下書き',
  申請中: '申請中',
  承認済み: '承認済み',
  完了: '完了',
});

export type SharePointStatus = '未確定' | '実施中' | '確定' | '完了';

const STATUS_TO_SHAREPOINT: Record<Status, SharePointStatus> = {
  下書き: '未確定',
  申請中: '実施中',
  承認済み: '確定',
  完了: '完了',
};

const EXACT_MATCHES: Record<string, Status> = {
  下書き: '下書き',
  未確定: '下書き',
  申請中: '申請中',
  実施中: '申請中',
  承認済み: '承認済み',
  確定: '承認済み',
  完了: '完了',
};

const LOWER_MATCHES: Record<string, Status> = {
  draft: '下書き',
  planned: '下書き',
  plan: '下書き',
  pending: '下書き',
  cancel: '下書き',
  cancelled: '下書き',
  canceled: '下書き',
  "in progress": '申請中',
  inprogress: '申請中',
  'in-progress': '申請中',
  submitted: '申請中',
  approve: '承認済み',
  approved: '承認済み',
  confirm: '承認済み',
  confirmed: '承認済み',
  done: '完了',
  complete: '完了',
  completed: '完了',
};

const normalizeCandidate = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return String(value ?? '').trim();
};

export const normalizeStatus = (value: unknown): Status => {
  const candidate = normalizeCandidate(value);
  if (!candidate) {
    return STATUS_DEFAULT;
  }
  const match = EXACT_MATCHES[candidate];
  if (match) {
    return match;
  }
  const lower = candidate.toLowerCase();
  const lowerMatch = LOWER_MATCHES[lower];
  if (lowerMatch) {
    return lowerMatch;
  }
  const normalized = SCHEDULE_STATUSES.find((status) => status === candidate);
  return normalized ?? STATUS_DEFAULT;
};

export const toSharePointStatus = (value: unknown): SharePointStatus => {
  const status = normalizeStatus(value);
  return STATUS_TO_SHAREPOINT[status] ?? STATUS_TO_SHAREPOINT[STATUS_DEFAULT];
};

export const toStatusEnum = (value: unknown): Status => normalizeStatus(value);

export const toSpChoice = (status: Status | null | undefined): SharePointStatus => {
  if (!status) {
    return STATUS_TO_SHAREPOINT[STATUS_DEFAULT];
  }
  return STATUS_TO_SHAREPOINT[status] ?? STATUS_TO_SHAREPOINT[STATUS_DEFAULT];
};

export const fromSpChoice = (spStatus: SharePointStatus | null | undefined): Status => {
  if (!spStatus) return STATUS_DEFAULT;
  
  const entry = Object.entries(STATUS_TO_SHAREPOINT).find(([_, value]) => value === spStatus);
  return entry ? entry[0] as Status : STATUS_DEFAULT;
};
