import { describe, expect, it, vi, beforeEach } from 'vitest';
import { spProvisioningCoordinator } from '@/sharepoint/spProvisioningCoordinator';
import type { useSP } from '@/lib/spClient';

/**
 * SharePointProvisioningCoordinator - フィールド整合性チェックのテスト
 * 
 * 目的:
 *   リストの存在チェックだけでなく、必須フィールドが正しく SharePoint 側に
 *   存在するか（Fuzzy Name Resolution を含めて）検証できるかをテストする。
 */

// SP_LIST_REGISTRY は実際の定義（Users_Master等）を使用するか、
// 必要に応じてモックする。ここでは結合度を下げ過ぎず、実際の registry interface を生かす。
vi.mock('@/sharepoint/spListRegistry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/sharepoint/spListRegistry')>();
    return {
        ...actual,
        SP_LIST_REGISTRY: [
            { 
              key: 'users_master', 
              displayName: '利用者マスタ', 
              resolve: () => 'Users_Master', 
              lifecycle: 'required', 
              essentialFields: ['Title', 'FullName', 'UserStatus'],
              category: 'master'
            }
        ]
    };
});

describe('SharePointProvisioningCoordinator - Granular Integrity Check', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // 最小限の SharePoint Client モック
    mockClient = {
      spFetch: vi.fn(),
      tryGetListMetadata: vi.fn(),
      getListFieldInternalNames: vi.fn(),
    } as unknown as ReturnType<typeof useSP>;
  });

  it('should PASS when all essential fields exist exactly', async () => {
    mockClient.tryGetListMetadata.mockResolvedValue({ title: 'Users_Master' });
    mockClient.getListFieldInternalNames.mockResolvedValue(new Set(['Title', 'FullName', 'UserStatus']));

    const result = await spProvisioningCoordinator.checkFieldIntegrity(mockClient, 'users_master');
    
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('should FAIL when an essential field is missing', async () => {
    mockClient.tryGetListMetadata.mockResolvedValue({ title: 'Users_Master' });
    // UserStatus が欠落
    mockClient.getListFieldInternalNames.mockResolvedValue(new Set(['Title', 'FullName']));

    const result = await spProvisioningCoordinator.checkFieldIntegrity(mockClient, 'users_master');
    
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('UserStatus');
  });

  it('should return multiple missing fields', async () => {
    mockClient.tryGetListMetadata.mockResolvedValue({ title: 'Users_Master' });
    mockClient.getListFieldInternalNames.mockResolvedValue(new Set(['Title'])); // 2つ欠落

    const result = await spProvisioningCoordinator.checkFieldIntegrity(mockClient, 'users_master');
    
    expect(result.missingFields).toEqual(expect.arrayContaining(['FullName', 'UserStatus']));
  });

  it('should handle non-existent lists gracefully (not in registry)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await spProvisioningCoordinator.checkFieldIntegrity(mockClient, 'unknown_key' as any);
    
    expect(result.isValid).toBe(false);
    expect(result.details).toContain('not registered');
  });

  it('should handle name mismatches correctly (SharePoint suffixes)', async () => {
    mockClient.tryGetListMetadata.mockResolvedValue({ title: 'Users_Master' });
    // SharePoint が勝手に末尾に数字をつけた場合 (FullName -> FullName0)
    // resolveInternalNamesDetailed がこれを許容するかを検証
    mockClient.getListFieldInternalNames.mockResolvedValue(new Set(['Title', 'FullName0', 'UserStatus']));

    const result = await spProvisioningCoordinator.checkFieldIntegrity(mockClient, 'users_master');
    
    // resolveInternalNamesDetailed は Strategy A (Suffix 0-9) で解決を試みるため、
    // FullName0 は FullName として正常に解決されるはず。
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });
});
