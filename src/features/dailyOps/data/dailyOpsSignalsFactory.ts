import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import type { DailyOpsSignalsPort } from './port';
import { createDailyOpsSignalsPort as createAdapterPort } from './sharePointAdapter';

/**
 * Factory: IDataProvider から DailyOpsSignalsPort を生成する。
 * 環境判定や Demo モード判定は DataProvider 層に集約されたため、
 * この層は単純な DI (Dependency Injection) のみに専念する。
 */
export function createDailyOpsSignalsPort(
  client: IDataProvider,
): DailyOpsSignalsPort {
  return createAdapterPort(client);
}
