import {
  isParentCommitEtagConflictFromHttp,
  isParentStorageUniquenessConflictFromHttp,
  ParentStorageUniquenessConflictError,
} from '../../../domain/persistence/dailyRecordPersistence';

export type DailyRecordParentHttpPhase = 'parent_create' | 'parent_commit';

export type DailyRecordParentHttpFailureKind =
  | 'storage_uniqueness_conflict'
  | 'commit_etag_conflict'
  | 'http_error';

type HttpLikeError = {
  status?: number;
  message?: string;
};

export function extractHttpStatusFromError(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = (error as HttpLikeError).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

export function extractHttpMessageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

export function classifyDailyRecordParentHttpFailure(
  status: number,
  bodyText: string | null | undefined,
  phase: DailyRecordParentHttpPhase,
): DailyRecordParentHttpFailureKind {
  if (phase === 'parent_create' && isParentStorageUniquenessConflictFromHttp(status, bodyText)) {
    return 'storage_uniqueness_conflict';
  }
  if (phase === 'parent_commit' && isParentCommitEtagConflictFromHttp(status, bodyText)) {
    return 'commit_etag_conflict';
  }
  return 'http_error';
}

export function classifyDailyRecordParentHttpFailureFromError(
  error: unknown,
  phase: DailyRecordParentHttpPhase,
): DailyRecordParentHttpFailureKind {
  const status = extractHttpStatusFromError(error);
  if (status === null) {
    return 'http_error';
  }
  return classifyDailyRecordParentHttpFailure(
    status,
    extractHttpMessageFromError(error),
    phase,
  );
}

export function throwDailyRecordParentHttpFailure(
  phase: DailyRecordParentHttpPhase,
  status: number,
  bodyText: string | null | undefined,
  context: { date?: string; commitId?: string } = {},
): never {
  const kind = classifyDailyRecordParentHttpFailure(status, bodyText, phase);
  if (kind === 'storage_uniqueness_conflict') {
    throw new ParentStorageUniquenessConflictError(
      `[DAILY-RECORD-PERSISTENCE-V1] Parent storage uniqueness rejected duplicate Title for date ${context.date ?? 'unknown'}.`,
    );
  }
  if (kind === 'commit_etag_conflict') {
    const commitSuffix = context.commitId
      ? ` Child rows for CommitId ${context.commitId} remain non-current ghosts.`
      : '';
    throw new Error(
      `[DAILY-RECORD-PERSISTENCE-V1] Parent optimistic commit failed: ETag conflict (HTTP ${status}).${commitSuffix}`,
    );
  }
  const commitSuffix = context.commitId
    ? ` Child rows for CommitId ${context.commitId} remain non-current ghosts.`
    : '';
  const label = phase === 'parent_create' ? 'Parent create' : 'Parent commit';
  throw new Error(
    `[DAILY-RECORD-PERSISTENCE-V1] ${label} failed with HTTP ${status}.${commitSuffix}`,
  );
}

export async function assertDailyRecordParentHttpResponse(
  phase: DailyRecordParentHttpPhase,
  response: Response,
  context: { date?: string; commitId?: string } = {},
): Promise<void> {
  if (response.ok) return;
  const bodyText = await response.text();
  throwDailyRecordParentHttpFailure(phase, response.status, bodyText, context);
}

export function rethrowClassifiedDailyRecordParentHttpError(
  error: unknown,
  phase: DailyRecordParentHttpPhase,
  context: { date?: string; commitId?: string } = {},
): never {
  if (error instanceof ParentStorageUniquenessConflictError) {
    throw error;
  }
  const status = extractHttpStatusFromError(error);
  if (status !== null) {
    throwDailyRecordParentHttpFailure(
      phase,
      status,
      extractHttpMessageFromError(error),
      context,
    );
  }
  throw error;
}
