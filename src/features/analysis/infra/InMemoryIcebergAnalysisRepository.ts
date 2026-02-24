import type { IcebergAnalysisRecord, IcebergAnalysisStatus } from '../domain/icebergAnalysisRecord';
import type {
    IcebergAnalysisListQuery,
    IcebergAnalysisRepository,
    SaveIcebergAnalysisInput,
} from '../domain/icebergAnalysisRepository';

export class InMemoryIcebergAnalysisRepository implements IcebergAnalysisRepository {
  private items: IcebergAnalysisRecord[] = [];

  async list(query: IcebergAnalysisListQuery): Promise<IcebergAnalysisRecord[]> {
    if (!query.userId) return [];
    return this.items.filter((item) => item.userId === query.userId);
  }

  async save(input: SaveIcebergAnalysisInput): Promise<IcebergAnalysisRecord> {
    const now = new Date().toISOString();
    const existingIndex = this.items.findIndex((item) => item.entryHash === input.entryHash);

    if (existingIndex >= 0) {
      // Update existing
      const prev = this.items[existingIndex];
      const updated: IcebergAnalysisRecord = {
        ...prev,
        title: input.title,
        snapshotJSON: input.snapshotJSON,
        status: input.status ?? prev.status,
        version: prev.version + 1,
        updatedAt: now,
      };
      this.items = [
        ...this.items.slice(0, existingIndex),
        updated,
        ...this.items.slice(existingIndex + 1),
      ];
      return updated;
    }

    // Create new
    const status: IcebergAnalysisStatus = input.status ?? 'Draft';
    const record: IcebergAnalysisRecord = {
      id: `mem-${Math.random().toString(36).slice(2)}`,
      userId: input.userId,
      title: input.title,
      snapshotJSON: input.snapshotJSON,
      version: 1,
      entryHash: input.entryHash,
      status,
      createdAt: now,
      updatedAt: now,
    };
    this.items = [record, ...this.items];
    return record;
  }
}
