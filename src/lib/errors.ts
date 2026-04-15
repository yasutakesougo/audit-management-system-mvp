export class AuthRequiredError extends Error {
  code: string;

  constructor(message: string = 'AUTH_REQUIRED') {
    super(message);
    this.name = 'AuthRequiredError';
    this.code = 'AUTH_REQUIRED';
  }
}

export class DataProviderItemNotFoundError extends Error {
  constructor(public resourceName: string, public id: string | number) {
    super(`Item not found in ${resourceName}: ${id}`);
    this.name = 'DataProviderItemNotFoundError';
  }
}

export class DataProviderNotInitializedError extends Error {
  constructor(public providerType: string) {
    super(`DataProvider [${providerType}] has not been initialized. Ensure <DataLayerProvider> or <SpProvider> is mounted.`);
    this.name = 'DataProviderNotInitializedError';
  }
}

export class SharePointItemNotFoundError extends DataProviderItemNotFoundError {
  constructor(message: string = 'SharePoint item was not found') {
    super('SharePoint', 'unknown');
    this.message = message;
    this.name = 'SharePointItemNotFoundError';
  }
}

export class SharePointMissingEtagError extends Error {
  constructor(message: string = 'SharePoint response did not include an ETag header') {
    super(message);
    this.name = 'SharePointMissingEtagError';
  }
}

export class SharePointBatchParseError extends Error {
  constructor(message: string = 'SharePoint batch response was not in multipart/mixed format') {
    super(message);
    this.name = 'SharePointBatchParseError';
  }
}

export type SafeError = {
  message: string;
  code?: string;
  cause?: unknown;
  name?: string;
};

const stringifyUnknown = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export function toSafeError(err: unknown): SafeError {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    const safe: SafeError = {
      message: err.message || err.name || 'Unknown error',
      code,
      cause: err,
    };
    if (err.name && err.name !== 'Error') {
      safe.name = err.name;
    }
    return safe;
  }

  if (typeof err === 'object' && err !== null) {
    if ('message' in err && typeof (err as { message?: unknown }).message === 'string') {
      return {
        message: (err as { message: string }).message,
        cause: err,
      };
    }
    return {
      message: stringifyUnknown(err),
      cause: err,
    };
  }

  if (typeof err === 'string') {
    return { message: err };
  }

  return {
    message: stringifyUnknown(err),
  };
}

// ---------------------------------------------------------------------------
// Unified Error Classification
// ---------------------------------------------------------------------------

/**
 * Error categories for consistent classification across all modules.
 * Replaces module-specific classifiers (classifyError in schedules, classifySpSyncError in dashboard).
 */
export type ErrorKind = 'auth' | 'network' | 'timeout' | 'schema' | 'server' | 'unknown';

export interface ErrorClassification {
  kind: ErrorKind;
  hint: string;
}

const ERROR_HINTS: Record<ErrorKind, string> = {
  auth: '認証の有効期限が切れたか、権限がありません。ログインし直すか管理者に確認してください。',
  network: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
  timeout: '通信がタイムアウトしました。しばらく待ってから再試行してください。',
  schema: 'データ形式に問題があります。管理者に連絡してください。',
  server: 'サーバー側でエラーが発生しています。しばらく待ってから再試行してください。',
  unknown: '予期しないエラーが発生しました。時間を置いて再度お試しください。',
};

/**
 * Classify any error into a standardised ErrorKind.
 *
 * Merges heuristics from:
 * - `classifyError` (adapters/schedules) — auth, network, schema
 * - `classifySpSyncError` (dashboard/logic) — auth, network, timeout, server
 *
 * @example
 * ```ts
 * const safe = toSafeError(error);
 * const kind = classifyError(safe); // 'auth' | 'network' | ...
 * ```
 */
export function classifyError(error: SafeError): ErrorKind {
  const normalized = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  const status = (error as Record<string, unknown>).status as number | undefined;
  const statusCode = (error as Record<string, unknown>).statusCode as number | undefined;
  const effectiveStatus = status ?? statusCode;

  // 1. Auth (MSAL, 401, 403)
  if (
    effectiveStatus === 401 ||
    effectiveStatus === 403 ||
    normalized.includes('interaction_required') ||
    normalized.includes('consent_required') ||
    normalized.includes('login_required') ||
    normalized.includes('no signed-in account') ||
    normalized.includes('aadsts70011') ||
    normalized.includes(".default scope can't be combined") ||
    /unauthor|forbidden/.test(normalized)
  ) {
    return 'auth';
  }

  // 2. Timeout
  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('deadline') ||
    effectiveStatus === 504
  ) {
    return 'timeout';
  }

  // 3. Network (fetch failures, connectivity)
  if (
    /failed to fetch|network error|connectivity/.test(normalized) ||
    (typeof globalThis !== 'undefined' &&
      'navigator' in globalThis &&
      !(globalThis as { navigator: { onLine: boolean } }).navigator.onLine)
  ) {
    return 'network';
  }

  // 4. Rate limit / transient service issues
  if (/429|503/.test(normalized)) {
    return 'network';
  }

  // 5. Schema / config (SharePoint field issues)
  if (/does not exist|property|field|schema|invalid/.test(normalized)) {
    return 'schema';
  }

  // 6. Server (5xx)
  if (effectiveStatus && effectiveStatus >= 500) {
    return 'server';
  }

  return 'unknown';
}

/**
 * Classify error and return user-facing hint.
 * Use this in UI components that need to display error guidance.
 */
export function classifyErrorWithHint(error: SafeError | null | undefined): ErrorClassification {
  if (!error) {
    return { kind: 'unknown', hint: ERROR_HINTS.unknown };
  }
  const kind = classifyError(error);
  return { kind, hint: ERROR_HINTS[kind] };
}

export interface SpErrorSummary {
  message: string;
  httpStatus?: number;
  sprequestguid?: string;
}

export function summarizeSpError(error: unknown): SpErrorSummary {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }

  const obj = error as Record<string, unknown>;
  let httpStatus: number | undefined;

  if (typeof obj.status === 'number') {
    httpStatus = obj.status;
  } else if (obj.response && typeof obj.response === 'object') {
    const resp = obj.response as Record<string, unknown>;
    if (typeof resp.status === 'number') httpStatus = resp.status;
    else if (typeof resp.statusCode === 'number') httpStatus = resp.statusCode;
  } else if (obj.cause && typeof obj.cause === 'object') {
    const cause = obj.cause as Record<string, unknown>;
    if (typeof cause.status === 'number') httpStatus = cause.status;
  }

  const message = typeof obj.message === 'string' ? obj.message : String(error);
  const sprequestguid = typeof obj.sprequestguid === 'string' ? obj.sprequestguid : undefined;

  return { message, httpStatus, sprequestguid };
}
