import { DriftEvent } from '../domain/driftLogic';
import { IDriftEventRepository } from '../domain/DriftEventRepository';

/**
 * InMemoryDriftEventRepository — ドリフトイベントのメモリ内永続化
 */
export class InMemoryDriftEventRepository implements IDriftEventRepository {
  private events: DriftEvent[] = [];

  async logEvent(event: DriftEvent): Promise<void> {
    this.events.push({
      ...event,
      id: event.id || Math.random().toString(36).substr(2, 9),
    });
  }

  async getEvents(filter?: {
    listName?: string;
    resolved?: boolean;
    since?: string;
  }, _signal?: AbortSignal): Promise<DriftEvent[]> {
    let result = this.events;

    if (filter?.listName) {
      result = result.filter(e => e.listName === filter.listName);
    }
    if (filter?.resolved !== undefined) {
      result = result.filter(e => e.resolved === filter.resolved);
    }
    if (filter?.since) {
      const sinceTime = Date.parse(filter.since);
      result = result.filter(e => Date.parse(e.detectedAt) >= sinceTime);
    }

    return result;
  }

  async markResolved(id: string): Promise<void> {
    const event = this.events.find(e => e.id === id);
    if (event) {
      event.resolved = true;
    }
  }
}
