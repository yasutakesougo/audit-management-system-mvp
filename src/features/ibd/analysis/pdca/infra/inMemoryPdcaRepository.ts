import type { IcebergPdcaItem } from '../domain/pdca';
import type {
    CreatePdcaInput,
    DeletePdcaInput,
    PdcaListQuery,
    PdcaRepository,
    UpdatePdcaInput,
} from '../domain/pdcaRepository';
import { mockPdcaItems } from '../mockPdcaItems';

export class InMemoryPdcaRepository implements PdcaRepository {
  private items: IcebergPdcaItem[] = [...mockPdcaItems];

  async list(query: PdcaListQuery) {
    if (!query.userId) return [];
    return this.items.filter((item) => {
      if (item.userId !== query.userId) return false;
      if (query.planningSheetId === undefined) return true;
      return item.planningSheetId === query.planningSheetId;
    });
  }

  async create(input: CreatePdcaInput): Promise<IcebergPdcaItem> {
    const now = new Date().toISOString();
    const item: IcebergPdcaItem = {
      id: `mem-${Math.random().toString(36).slice(2)}`,
      userId: input.userId,
      planningSheetId: input.planningSheetId,
      title: input.title,
      summary: input.summary ?? '',
      phase: input.phase ?? 'PLAN',
      createdAt: now,
      updatedAt: now,
    };
    this.items = [item, ...this.items];
    return item;
  }

  async update(input: UpdatePdcaInput): Promise<IcebergPdcaItem> {
    const index = this.items.findIndex((item) => item.id === input.id);
    if (index < 0) {
      throw new Error(`PDCA item not found: ${input.id}`);
    }

    const prev = this.items[index];
    const next: IcebergPdcaItem = {
      ...prev,
      planningSheetId: input.planningSheetId ?? prev.planningSheetId,
      title: input.title ?? prev.title,
      summary: input.summary ?? prev.summary,
      phase: input.phase ?? prev.phase,
      updatedAt: new Date().toISOString(),
    };

    this.items = [...this.items.slice(0, index), next, ...this.items.slice(index + 1)];
    return next;
  }

  async delete(input: DeletePdcaInput): Promise<void> {
    this.items = this.items.filter((item) => item.id !== input.id);
  }
}
