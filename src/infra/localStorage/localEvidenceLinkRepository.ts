/**
 * localEvidenceLinkRepository — Evidence Links の localStorage 永続化
 *
 * 支援計画シートごとの根拠紐づけ（EvidenceLinkMap）を localStorage に保存・復元する。
 *
 * @module infra/localStorage/localEvidenceLinkRepository
 */

import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import { createEmptyEvidenceLinkMap } from '@/domain/isp/evidenceLink';

const STORAGE_KEY = 'evidence-links';

// ── Internal helpers ──

function readAll(): Record<string, EvidenceLinkMap> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, EvidenceLinkMap>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, EvidenceLinkMap>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Public API ──

export const localEvidenceLinkRepository = {
  /**
   * 支援計画シートIDに紐づくEvidence Linksを取得
   * 存在しない場合は空のマップを返す
   */
  get(planningSheetId: string): EvidenceLinkMap {
    const all = readAll();
    return all[planningSheetId] ?? createEmptyEvidenceLinkMap();
  },

  /**
   * Evidence Linksを保存
   */
  save(planningSheetId: string, links: EvidenceLinkMap): void {
    const all = readAll();
    all[planningSheetId] = links;
    writeAll(all);
  },

  /**
   * 指定シートのEvidence Linksを削除
   */
  delete(planningSheetId: string): void {
    const all = readAll();
    delete all[planningSheetId];
    writeAll(all);
  },

  /**
   * 全シートの保存済み根拠件数サマリーを取得
   */
  getSummary(): Record<string, { abc: number; pdca: number }> {
    const all = readAll();
    const summary: Record<string, { abc: number; pdca: number }> = {};
    for (const [sheetId, links] of Object.entries(all)) {
      const allLinks = [
        ...links.antecedentStrategies,
        ...links.teachingStrategies,
        ...links.consequenceStrategies,
      ];
      if (allLinks.length > 0) {
        summary[sheetId] = {
          abc: allLinks.filter(l => l.type === 'abc').length,
          pdca: allLinks.filter(l => l.type === 'pdca').length,
        };
      }
    }
    return summary;
  },
};
