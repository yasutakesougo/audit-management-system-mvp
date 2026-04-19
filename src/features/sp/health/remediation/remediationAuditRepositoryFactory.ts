import { createRepositoryFactory, type BaseFactoryOptions } from '@/lib/createRepositoryFactory';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { 
  type IRemediationAuditRepository, 
  InMemoryRemediationAuditRepository 
} from './RemediationAuditRepository';
import { SharePointRemediationAuditRepository } from './SharePointRemediationAuditRepository';
import { HybridRemediationAuditRepository } from './HybridRemediationAuditRepository';

export interface RemediationAuditRepositoryOptions extends BaseFactoryOptions {
  /** 
   * ハイブリッドモードを強制するかどうか。
   * デフォルトは true（SharePoint 書き込み + メモリ読み込み）。 
   */
  hybrid?: boolean;
}

/**
 * 修復監査リポジトリのファクトリ。
 * UI層からは useRemediationAuditRepository() を使用してください。
 */
export const remediationAuditRepositoryFactory = createRepositoryFactory<
  IRemediationAuditRepository,
  RemediationAuditRepositoryOptions
>({
  name: 'RemediationAudit',
  
  createDemo: () => new InMemoryRemediationAuditRepository(),
  
  createReal: (options) => {
    const { acquireToken, hybrid = true } = options;
    if (!acquireToken) {
      throw new Error('[RemediationAuditRepoFactory] acquireToken is required for real repository.');
    }

    const { baseUrl } = ensureConfig();
    const client = createSpClient(acquireToken, baseUrl);

    if (hybrid) {
      return new HybridRemediationAuditRepository(client);
    }
    return new SharePointRemediationAuditRepository(client);
  },
});

/**
 * 修復監査リポジトリを取得する React Hook。
 * 
 * @example
 * const repository = useRemediationAuditRepository();
 */
export const useRemediationAuditRepository = () => remediationAuditRepositoryFactory.useRepository();
