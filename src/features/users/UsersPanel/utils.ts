/**
 * UsersPanel utilities
 */
import { AuthRequiredError } from '../../../lib/errors';

export const buildErrorMessage = (error: unknown): string => {
  if (!error) return '原因不明のエラーが発生しました。';
  if (error instanceof AuthRequiredError) {
    return 'サインインが必要です。上部の「サインイン」を押して認証を完了してください。';
  }
  if (error instanceof Error) {
    if (error.message === 'AUTH_REQUIRED') {
      return 'サインインが必要です。上部の「サインイン」を押して認証を完了してください。';
    }
    return error.message;
  }
  return String(error);
};
