export class AuthRequiredError extends Error {
  code: string;

  constructor(message: string = 'AUTH_REQUIRED') {
    super(message);
    this.name = 'AuthRequiredError';
    this.code = 'AUTH_REQUIRED';
  }
}

export class SharePointItemNotFoundError extends Error {
  constructor(message: string = 'SharePoint item was not found') {
    super(message);
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
