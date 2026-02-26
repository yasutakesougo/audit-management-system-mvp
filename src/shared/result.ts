/**
 * Result型：型安全なエラーハンドリング
 * 412 Conflict / 403 Forbidden などを例外ではなく値として扱う
 */

export type ResultError =
  | { kind: 'conflict'; message?: string; etag?: string; resource?: string; op?: 'create' | 'update' | 'remove'; id?: string }
  | { kind: 'forbidden'; message?: string }
  | { kind: 'notFound'; message?: string }
  | { kind: 'validation'; message: string; details?: unknown }
  | { kind: 'network'; message: string; cause?: unknown }
  | { kind: 'unknown'; message: string; cause?: unknown };

export type Result<T> =
  | { isOk: true; value: T }
  | { isOk: false; error: ResultError };

/**
 * Result ヘルパー
 */
export const result = {
  ok<T>(value: T): Result<T> {
    return { isOk: true, value };
  },

  err<T>(error: ResultError): Result<T> {
    return { isOk: false, error };
  },

  conflict<T>(options?: { message?: string; etag?: string; resource?: string; op?: 'create' | 'update' | 'remove'; id?: string }): Result<T> {
    return result.err<T>({ kind: 'conflict', ...options });
  },

  forbidden<T>(message?: string): Result<T> {
    return result.err<T>({ kind: 'forbidden', message });
  },

  notFound<T>(message?: string): Result<T> {
    return result.err<T>({ kind: 'notFound', message });
  },

  validation<T>(message: string, details?: unknown): Result<T> {
    return result.err<T>({ kind: 'validation', message, details });
  },

  unknown<T>(message: string, cause?: unknown): Result<T> {
    return result.err<T>({ kind: 'unknown', message, cause });
  },
};

/**
 * 型ガード: Result の isOk フィールドで型を絞る
 */
export const isOk = <T,>(r: Result<T>): r is { isOk: true; value: T } => r.isOk;
export const isErr = <T,>(r: Result<T>): r is { isOk: false; error: ResultError } => !r.isOk;

/**
 * 便宜：Result を Promise に変換（async 関数での使用）
 */
export async function resultFromPromise<T>(
  promise: Promise<T>
): Promise<Result<T>> {
  try {
    const value = await promise;
    return result.ok(value);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return result.unknown(message);
  }
}
