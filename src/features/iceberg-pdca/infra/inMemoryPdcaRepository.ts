import { mockPdcaItems } from '../mockPdcaItems';
import type { PdcaListQuery, PdcaRepository } from '../domain/pdcaRepository';

export class InMemoryPdcaRepository implements PdcaRepository {
  async list(query: PdcaListQuery) {
    if (!query.userId) return [];
    return mockPdcaItems.filter((item) => item.userId === query.userId);
  }
}
