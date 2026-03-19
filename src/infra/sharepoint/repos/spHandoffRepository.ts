import type { UseSP } from "@/lib/spClient";
import type { Handoff } from "@/domain/Handoff";
import type { HandoffRepository, CreateHandoffInput } from "@/domain/HandoffRepository";
import { HandoffStatus } from "@/domain/Handoff";
import { mapSPToHandoff, mapHandoffToSPPayload, SPHandoffItemSchema } from "../fields/handoffFields";

/**
 * SharePoint の Handoff リストを対象とする HandoffRepository の実装
 *
 * 2026-03-19: リスト名を 'Handoffs' → 'Handoff' (単数形)、
 *             フィルタ列名を cr015_* → 実列名 に修正
 */
export class SPHandoffRepository implements HandoffRepository {
  constructor(private client: UseSP) {}

  private get listTitle() {
    return "Handoff";
  }

  async getHandoffsByDate(targetDate: string): Promise<Handoff[]> {
    const rawItems = await this.client.getListItemsByTitle(
      this.listTitle,
      undefined,
      `CarryOverDate eq '${targetDate}'`,
      undefined,
      5000
    );

    return rawItems
      .map((item) => {
        const parsed = SPHandoffItemSchema.safeParse(item);
        if (!parsed.success) {
          console.warn("[SPHandoffRepository] Parse failed:", parsed.error.message, item);
          return null;
        }
        return mapSPToHandoff(parsed.data);
      })
      .filter((h): h is Handoff => h !== null);
  }

  async getHandoffsByUser(userId: string): Promise<Handoff[]> {
    const rawItems = await this.client.getListItemsByTitle(
      this.listTitle,
      undefined,
      `UserCode eq '${userId}'`,
      undefined,
      5000
    );

    return rawItems
      .map((item) => {
        const parsed = SPHandoffItemSchema.safeParse(item);
        if (!parsed.success) return null;
        return mapSPToHandoff(parsed.data);
      })
      .filter((h): h is Handoff => h !== null);
  }

  async createHandoff(input: CreateHandoffInput): Promise<Handoff> {
    const domainObj: Handoff = {
      id: crypto.randomUUID(),
      userId: input.userId,
      targetDate: input.targetDate,
      content: input.content,
      priority: input.priority,
      status: "unread", // 作成時は未読固定
      reporterName: input.reporterName,
      recordedAt: input.recordedAt,
    };

    const payload = mapHandoffToSPPayload(domainObj);
    const result = await this.client.addListItemByTitle(this.listTitle, payload) as { Id?: number };

    if (!result || !result.Id) {
      throw new Error("SharePoint failed to create handoff item.");
    }
    return domainObj;
  }

  async updateHandoffStatus(id: string, newStatus: HandoffStatus): Promise<void> {
    // まず SP上の ID を取得するためにドメインID（cr015_recordId）で検索
    const rawItems = await this.client.getListItemsByTitle<{ Id: number }>(
      this.listTitle,
      ["Id"],
      `Id eq ${Number(id)}`
    );

    if (rawItems.length === 0) {
      throw new Error(`Handoff item not found in SharePoint for domain id: ${id}`);
    }

    const spId = rawItems[0].Id;
    await this.client.updateItemByTitle(this.listTitle, spId, {
      Status: newStatus === 'read' ? '確認済' : '未対応',
    });
  }
}
