import { ZodError, ZodIssue } from 'zod';

export interface ActionableErrorInfo {
  path: string;
  message: string;
  expected?: string;
  received?: string;
  code: string;
}

/**
 * Type guard for ZodError
 */
export const isZodError = (err: unknown): err is ZodError => {
  return err instanceof ZodError || (err != null && typeof err === 'object' && (err as { name?: string }).name === 'ZodError');
};

/**
 * Formats a ZodError into a list of actionable error info.
 * Translates Zod hierarchy into human-readable field names where possible.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const formatZodError = (error: ZodError): ActionableErrorInfo[] => {
  return error.issues.map((issue: ZodIssue) => {
    const path = issue.path.join('.') || '(Root)';
    let message = issue.message;

    // Handle specific Zod issue types for better readability
    if (issue.code === 'invalid_type') {
      const typeIssue = issue as any;
      message = `${path}: Expected ${typeIssue.expected}, received ${typeIssue.received}`;
    } else if (issue.code === 'too_small') {
      const smallIssue = issue as any;
      message = `${path}: Value is too small (Minimum ${smallIssue.minimum})`;
    } else if (issue.code === 'too_big') {
      const bigIssue = issue as any;
      message = `${path}: Value is too big (Maximum ${bigIssue.maximum})`;
    } else if ((issue as any).code === 'invalid_string') {
      const stringIssue = issue as any;
      if (typeof stringIssue.validation === 'string' && stringIssue.validation === 'url') {
        message = `${path}: Invalid URL format`;
      }
    }

    const info: ActionableErrorInfo = {
      path,
      message,
      code: issue.code,
    };

    if ('expected' in issue) {
      info.expected = String((issue as any).expected);
    }
    if ('received' in issue) {
      info.received = String((issue as any).received);
    }

    return info;
  });
};

/**
 * Formats an unknown error into a summary string.
 */
export const getErrorSummary = (err: unknown): string => {
  if (isZodError(err)) {
    const issues = formatZodError(err);
    return `Zod Validation Error: ${issues.length} issues found.\n` +
           issues.map(i => `- ${i.message}`).join('\n');
  }
  if (err instanceof Error) return err.message;
  return String(err);
};
