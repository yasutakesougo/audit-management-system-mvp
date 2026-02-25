import { __resetAppConfigForTests } from '@/lib/env';
import { resetParsedEnvForTests } from '@/lib/env.schema';
import { resetTestConfigOverride } from './mockEnv';

/**
 * テストの afterEach hook を統一管理。
 *
 * 以下を確実にリセット：
 * - すべての vi mock と spy
 * - per-test config override
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
    // per-test config override をリセット
    resetTestConfigOverride();
    // env schema / config cache をリセット
    resetParsedEnvForTests();
    __resetAppConfigForTests();
  });
}
