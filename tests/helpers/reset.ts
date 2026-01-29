import { afterEach, vi } from 'vitest';

/**
 * テストの afterEach hook を統一管理。
 *
 * 以下を確実にリセット：
 * - すべての vi mock と spy
 *
 * @example
 * // spec の冒頭に追加
 * import { installTestResets } from '../helpers/reset';
 * installTestResets();
 */
export function installTestResets() {
  afterEach(() => {
    // すべてのモックと spy をリセット
    vi.restoreAllMocks();
  });
}
