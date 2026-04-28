import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';
import { DataProviderIspRepository, __resetIspWarningCache } from '@/data/isp/infra/DataProviderIspRepository';
import { DataProviderPlanningSheetRepository, __resetPlanningSheetWarningCache } from '@/data/isp/infra/DataProviderPlanningSheetRepository';
import { DataProviderProcedureRecordRepository, __resetProcedureRecordWarningCache } from '@/data/isp/infra/DataProviderProcedureRecordRepository';

describe('EssentialFieldsWarning Regression Tests', () => {
  let provider: InMemoryDataProvider;

  beforeEach(() => {
    provider = new InMemoryDataProvider();
    __resetIspWarningCache();
    __resetPlanningSheetWarningCache();
    __resetProcedureRecordWarningCache();
    vi.restoreAllMocks();
  });

  it('should not log essential field warnings in memory backend (normal case)', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    
    const ispRepo = new DataProviderIspRepository(provider);
    const sheetRepo = new DataProviderPlanningSheetRepository(provider);
    const procRepo = new DataProviderProcedureRecordRepository(provider);

    // Trigger resolution
    await (ispRepo as any).resolveSource();
    await (sheetRepo as any).resolveSource();
    await (procRepo as any).resolveSource();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should deduplicate essential field warnings (one log per listTitle)', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    
    // スキーマを削除して意図的に失敗させる
    (provider as any).schemaStorage.delete('ISP_Master');

    const repo1 = new DataProviderIspRepository(provider);
    const repo2 = new DataProviderIspRepository(provider);

    await (repo1 as any).resolveSource();
    await (repo2 as any).resolveSource();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[DataProviderIspRepository] Essential fields missing in ISP_Master'));
  });

  it('should reset deduplication cache when requested', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    (provider as any).schemaStorage.delete('ISP_Master');

    const repo1 = new DataProviderIspRepository(provider);
    await (repo1 as any).resolveSource();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    __resetIspWarningCache();

    const repo2 = new DataProviderIspRepository(provider);
    await (repo2 as any).resolveSource();
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
