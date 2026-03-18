import type { Handoff } from "@/domain/Handoff";
import type { HandoffRepository, CreateHandoffInput } from "@/domain/HandoffRepository";
import { HandoffStatus } from "@/domain/Handoff";

/**
 * LocalMock を用いた HandoffRepository の実装
 */
export class LocalHandoffRepository implements HandoffRepository {
  private key = "handoffs_v1_draft";

  private getItems(): Handoff[] {
    try {
      const stored = localStorage.getItem(this.key);
      if (!stored) return [];
      return JSON.parse(stored) as Handoff[];
    } catch {
      return [];
    }
  }

  private saveItems(items: Handoff[]): void {
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  async getHandoffsByDate(targetDate: string): Promise<Handoff[]> {
    // 擬似遅延
    await new Promise((resolve) => setTimeout(resolve, 300));
    return this.getItems().filter((h) => h.targetDate === targetDate);
  }

  async getHandoffsByUser(userId: string): Promise<Handoff[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return this.getItems().filter((h) => h.userId === userId);
  }

  async createHandoff(input: CreateHandoffInput): Promise<Handoff> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const items = this.getItems();
    
    const newHandoff: Handoff = {
      id: crypto.randomUUID(),
      userId: input.userId,
      targetDate: input.targetDate,
      content: input.content,
      priority: input.priority,
      status: "unread", // 作成時は必ず未読
      reporterName: input.reporterName,
      recordedAt: input.recordedAt,
    };

    items.push(newHandoff);
    this.saveItems(items);

    return newHandoff;
  }

  async updateHandoffStatus(id: string, newStatus: HandoffStatus): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let updated = false;
    const items = this.getItems().map((h) => {
      if (h.id === id) {
        updated = true;
        return { ...h, status: newStatus };
      }
      return h;
    });

    if (!updated) {
      throw new Error(`Handoff ID ${id} is not found.`);
    }

    this.saveItems(items);
  }
}
