/**
 * slashMenuItems.spec.ts
 *
 * 議事録専用 Slash メニュー定義のテスト。
 *
 * 観点:
 * 1. メニュー項目が全10項目生成されること
 * 2. 各項目が必須プロパティ（title, onItemClick, group）を持つこと
 * 3. 優先グループ（議事録）に5項目、補助グループに5項目
 * 4. aliases が設定されていること（日本語・英語・ローマ字での検索性）
 * 5. prefix パターンが正しく定義されていること
 * 6. 個別項目の aliases 検証
 */
import { describe, expect, it } from 'vitest';
import {
  getMeetingMinutesSlashMenuItems,
  MEETING_MENU_ITEM_TITLES,
  PRIMARY_MENU_ITEM_TITLES,
  SECONDARY_MENU_ITEM_TITLES,
  MEETING_PREFIX,
} from '../slashMenuItems';
import { BlockNoteEditor } from '@blocknote/core';

describe('slashMenuItems', () => {
  const editor = BlockNoteEditor.create();

  // ── 全体構造 ──────────────────────────────────────────────────

  describe('getMeetingMinutesSlashMenuItems', () => {
    it('should return 10 menu items', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      expect(items.length).toBe(10);
    });

    it('should contain all expected titles', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      const titles = items.map((item) => item.title);

      for (const expected of MEETING_MENU_ITEM_TITLES) {
        expect(titles).toContain(expected);
      }
    });

    it('should have onItemClick for all items', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      for (const item of items) {
        expect(typeof item.onItemClick).toBe('function');
      }
    });

    it('should have aliases for all items', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      for (const item of items) {
        expect(item.aliases).toBeDefined();
        expect(Array.isArray(item.aliases)).toBe(true);
        expect(item.aliases!.length).toBeGreaterThan(0);
      }
    });

    it('should have subtext for all items', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      for (const item of items) {
        expect(typeof item.subtext).toBe('string');
        expect((item.subtext as string).length).toBeGreaterThan(0);
      }
    });
  });

  // ── グループ分け ──────────────────────────────────────────────

  describe('group assignment', () => {
    it('should have 5 items in 議事録 group', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      const primary = items.filter((i) => i.group === '議事録');
      expect(primary.length).toBe(5);
    });

    it('should have 5 items in 補助 group', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      const secondary = items.filter((i) => i.group === '補助');
      expect(secondary.length).toBe(5);
    });

    it('議事録 group should contain expected titles', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      const primaryTitles = items
        .filter((i) => i.group === '議事録')
        .map((i) => i.title);

      for (const t of PRIMARY_MENU_ITEM_TITLES) {
        expect(primaryTitles).toContain(t);
      }
    });

    it('補助 group should contain expected titles', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      const secondaryTitles = items
        .filter((i) => i.group === '補助')
        .map((i) => i.title);

      for (const t of SECONDARY_MENU_ITEM_TITLES) {
        expect(secondaryTitles).toContain(t);
      }
    });

    it('priority items should appear before secondary items', () => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      const firstSecondaryIdx = items.findIndex((i) => i.group === '補助');
      const lastPrimaryIdx = items.length - 1 -
        [...items].reverse().findIndex((i) => i.group === '議事録');

      expect(lastPrimaryIdx).toBeLessThan(firstSecondaryIdx);
    });
  });

  // ── Prefix 定数 ──────────────────────────────────────────────

  describe('MEETING_PREFIX', () => {
    it('should define agenda prefix', () => {
      expect(MEETING_PREFIX.agenda).toBe('■ 議題：');
    });

    it('should define report prefix', () => {
      expect(MEETING_PREFIX.report).toBe('【報告】');
    });

    it('should define decision prefix', () => {
      expect(MEETING_PREFIX.decision).toBe('【決定事項】');
    });

    it('should define notice prefix', () => {
      expect(MEETING_PREFIX.notice).toBe('【連絡事項】');
    });

    it('should define pending prefix', () => {
      expect(MEETING_PREFIX.pending).toBe('【継続検討】');
    });

    it('should define nextSchedule prefix', () => {
      expect(MEETING_PREFIX.nextSchedule).toBe('【次回予定】');
    });
  });

  // ── 個別項目 aliases ─────────────────────────────────────────

  describe('individual item aliases', () => {
    const findItem = (title: string) => {
      const items = getMeetingMinutesSlashMenuItems(editor);
      return items.find((i) => i.title === title);
    };

    it('議題 should have agenda-related aliases', () => {
      const item = findItem('議題');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('agenda');
      expect(item!.aliases).toContain('gidai');
    });

    it('報告 should have report-related aliases', () => {
      const item = findItem('報告');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('report');
      expect(item!.aliases).toContain('houkoku');
    });

    it('決定事項 should have decision-related aliases', () => {
      const item = findItem('決定事項');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('decision');
      expect(item!.aliases).toContain('kettei');
    });

    it('アクション should have action/todo aliases', () => {
      const item = findItem('アクション');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('action');
      expect(item!.aliases).toContain('todo');
    });

    it('連絡事項 should have notice aliases', () => {
      const item = findItem('連絡事項');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('notice');
      expect(item!.aliases).toContain('renraku');
    });

    it('継続検討 should have pending aliases', () => {
      const item = findItem('継続検討');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('pending');
      expect(item!.aliases).toContain('keizoku');
    });

    it('次回予定 should have schedule aliases', () => {
      const item = findItem('次回予定');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('next');
      expect(item!.aliases).toContain('jikai');
    });

    it('箇条書き should have bullet aliases', () => {
      const item = findItem('箇条書き');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('bullet');
      expect(item!.aliases).toContain('list');
    });

    it('チェックリスト should have check aliases', () => {
      const item = findItem('チェックリスト');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('check');
      expect(item!.aliases).toContain('checkbox');
    });

    it('見出し should have heading aliases', () => {
      const item = findItem('見出し');
      expect(item).toBeDefined();
      expect(item!.aliases).toContain('heading');
      expect(item!.aliases).toContain('h2');
    });
  });

  // ── タイトル一覧定数 ─────────────────────────────────────────

  describe('title constants', () => {
    it('MEETING_MENU_ITEM_TITLES should contain exactly 10 titles', () => {
      expect(MEETING_MENU_ITEM_TITLES.length).toBe(10);
    });

    it('PRIMARY_MENU_ITEM_TITLES should contain exactly 5', () => {
      expect(PRIMARY_MENU_ITEM_TITLES.length).toBe(5);
    });

    it('SECONDARY_MENU_ITEM_TITLES should contain exactly 5', () => {
      expect(SECONDARY_MENU_ITEM_TITLES.length).toBe(5);
    });

    it('MEETING_MENU_ITEM_TITLES should be the union of primary and secondary', () => {
      const combined = [...PRIMARY_MENU_ITEM_TITLES, ...SECONDARY_MENU_ITEM_TITLES];
      expect(MEETING_MENU_ITEM_TITLES).toEqual(combined);
    });
  });
});
