/**
 * InMemory ServiceProvisionRecords Repository
 *
 * テスト・デモ用のインメモリ実装。
 */
import type { ServiceProvisionRepository } from '../domain/ServiceProvisionRepository';
import type { ServiceProvisionRecord, UpsertProvisionInput } from '../domain/types';
import { makeEntryKey } from '../domain/types';

export class InMemoryServiceProvisionRepository
  implements ServiceProvisionRepository
{
  private seq = 1;
  private items: ServiceProvisionRecord[] = [];

  async getByEntryKey(
    entryKey: string,
  ): Promise<ServiceProvisionRecord | null> {
    return this.items.find((x) => x.entryKey === entryKey) ?? null;
  }

  async listByDate(
    recordDateISO: string,
  ): Promise<ServiceProvisionRecord[]> {
    return this.items.filter((x) => x.recordDateISO === recordDateISO);
  }

  async listByMonth(
    monthISO: string,
  ): Promise<ServiceProvisionRecord[]> {
    return this.items.filter((x) => x.recordDateISO.startsWith(monthISO));
  }

  async upsertByEntryKey(
    input: UpsertProvisionInput,
  ): Promise<ServiceProvisionRecord> {
    const entryKey = makeEntryKey(input.userCode, input.recordDateISO);
    const existing = await this.getByEntryKey(entryKey);

    if (!existing) {
      const created: ServiceProvisionRecord = {
        id: this.seq++,
        entryKey,
        userCode: input.userCode,
        recordDateISO: input.recordDateISO,
        status: input.status,
        startHHMM: input.startHHMM ?? null,
        endHHMM: input.endHHMM ?? null,
        hasTransport: !!input.hasTransport || !!input.hasTransportPickup || !!input.hasTransportDropoff,
        hasTransportPickup: !!input.hasTransportPickup,
        hasTransportDropoff: !!input.hasTransportDropoff,
        hasMeal: !!input.hasMeal,
        hasBath: !!input.hasBath,
        hasExtended: !!input.hasExtended,
        hasAbsentSupport: !!input.hasAbsentSupport,
        note: input.note ?? '',
        source: input.source ?? 'Unified',
        updatedByUPN: input.updatedByUPN ?? '',
      };
      this.items = [...this.items, created];
      return created;
    }

    const updated: ServiceProvisionRecord = {
      ...existing,
      status: input.status,
      startHHMM: input.startHHMM ?? null,
      endHHMM: input.endHHMM ?? null,
      hasTransport: !!input.hasTransport || !!input.hasTransportPickup || !!input.hasTransportDropoff,
      hasTransportPickup: !!input.hasTransportPickup,
      hasTransportDropoff: !!input.hasTransportDropoff,
      hasMeal: !!input.hasMeal,
      hasBath: !!input.hasBath,
      hasExtended: !!input.hasExtended,
      hasAbsentSupport: !!input.hasAbsentSupport,
      note: input.note ?? '',
      source: input.source ?? existing.source,
      updatedByUPN: input.updatedByUPN ?? existing.updatedByUPN,
    };

    this.items = this.items.map((x) =>
      x.entryKey === entryKey ? updated : x,
    );
    return updated;
  }
}

/** シングルトンインスタンス（デモモード用） */
export const inMemoryServiceProvisionRepository: ServiceProvisionRepository =
  new InMemoryServiceProvisionRepository();
