/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * slashMenuItems.ts — 議事録専用 Slash メニュー定義
 *
 * 責務:
 * - BlockNote の Slash メニューに議事録特化の項目を追加する
 * - 各項目は既存 block type (heading, paragraph, bulletListItem,
 *   checkListItem) にマップする（独自 block schema は Phase 2 では導入しない）
 * - prefix パターン（【決定事項】等）で意味タグ付けし、
 *   将来の block 抽出・handoff 連携に備える
 *
 * グループ構成:
 * - 「議事録」: 議題, 報告, 決定事項, アクション, 連絡事項（優先表示）
 * - 「補助」: 継続検討, 次回予定, 箇条書き, チェックリスト, 見出し
 * - 標準: BlockNote デフォルト項目（そのまま維持）
 */
// NOTE: BlockNoteEditor の型はデフォルトスキーマを前提とするため、
// カスタムスキーマを使用している場合は any を指定して型エラーを回避する
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import type { DefaultReactSuggestionItem } from '@blocknote/react';

// ──────────────────────────────────────────────────────────────
// グループ名定数
// ──────────────────────────────────────────────────────────────

const GROUP_PRIMARY = '議事録';
const GROUP_SECONDARY = '補助';

// ──────────────────────────────────────────────────────────────
// Prefix 定数（将来の block 抽出で検索キーとして使用可能）
// ──────────────────────────────────────────────────────────────

export const MEETING_PREFIX = {
  agenda: '■ 議題：',
  report: '【報告】',
  decision: '【決定事項】',
  notice: '【連絡事項】',
  pending: '【継続検討】',
  nextSchedule: '【次回予定】',
} as const;

// ──────────────────────────────────────────────────────────────
// ヘルパー: 見出しブロックを挿入し、直後に指定タイプの空ブロックを追加
// ──────────────────────────────────────────────────────────────

function insertSectionHeading(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  text: string,
  level: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  followBlock?: Record<string, any>
): void {
  insertOrUpdateBlockForSlashMenu(editor, {
    type: 'heading',
    props: { level },
    content: [{ type: 'text', text, styles: {} }],
  } as any);
  if (followBlock) {
    editor.insertBlocks(
      [followBlock],
      editor.getTextCursorPosition().block,
      'after'
    );
  }
}

// ──────────────────────────────────────────────────────────────
// Primary: 議事録メニュー項目（優先グループ）
// ──────────────────────────────────────────────────────────────

function getPrimaryItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
): DefaultReactSuggestionItem[] {
  return [
    // ── 議題 ──
    {
      title: '議題',
      onItemClick: () => {
        insertSectionHeading(editor, MEETING_PREFIX.agenda, 2, {
          type: 'paragraph',
        } as any);
      },
      aliases: ['gidai', 'agenda', 'topic', '題目'],
      group: GROUP_PRIMARY,
      subtext: 'セクション見出し（議題）を挿入',
    },

    // ── 報告 ──
    {
      title: '報告',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'report',
          content: [],
        } as any);
      },
      aliases: ['houkoku', 'report', '状況報告', '共有'],
      group: GROUP_PRIMARY,
      subtext: '報告事項（report ブロック）を挿入',
    },

    // ── 決定事項 ──
    {
      title: '決定事項',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'decision',
          content: [],
        } as any);
      },
      aliases: ['kettei', 'decision', '決定', '確定'],
      group: GROUP_PRIMARY,
      subtext: '確定した内容（decision ブロック）を挿入',
    },

    // ── アクション ──
    {
      title: 'アクション',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'action',
          content: [],
        } as any);
      },
      aliases: ['action', 'todo', 'タスク', '対応', 'アクション'],
      group: GROUP_PRIMARY,
      subtext: '対応事項（action ブロック）を追加',
    },

    // ── 連絡事項 ──
    {
      title: '連絡事項',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'notification',
          content: [],
        } as any);
      },
      aliases: ['renraku', 'notice', 'info', '周知', '連絡'],
      group: GROUP_PRIMARY,
      subtext: '連絡事項（notification ブロック）を追加',
    },
  ];
}

// ──────────────────────────────────────────────────────────────
// Secondary: 補助メニュー項目
// ──────────────────────────────────────────────────────────────

function getSecondaryItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
): DefaultReactSuggestionItem[] {
  return [
    // ── 継続検討 ──
    {
      title: '継続検討',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'continuingDiscussion',
          content: [],
        } as any);
      },
      aliases: ['keizoku', 'pending', '保留', '未確定', '検討中'],
      group: GROUP_SECONDARY,
      subtext: '未確定事項（continuingDiscussion ブロック）を挿入',
    },

    // ── 次回予定 ──
    {
      title: '次回予定',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'nextSchedule',
          content: [],
        } as any);
      },
      aliases: ['jikai', 'next', 'schedule', '日程', '予定'],
      group: GROUP_SECONDARY,
      subtext: '次回の日程・予定（nextSchedule ブロック）を追加',
    },

    // ── 箇条書き ──
    {
      title: '箇条書き',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'bulletListItem',
          content: [{ type: 'text', text: '', styles: {} }],
        } as any);
      },
      aliases: ['bullet', 'list', 'リスト', '箇条'],
      group: GROUP_SECONDARY,
      subtext: '箇条書きリストを追加',
    },

    // ── チェックリスト ──
    {
      title: 'チェックリスト',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'checkListItem',
          props: { checked: false },
          content: [{ type: 'text', text: '', styles: {} }],
        } as any);
      },
      aliases: ['check', 'checkbox', 'チェック', 'タスク'],
      group: GROUP_SECONDARY,
      subtext: 'チェックボックス付き項目を追加',
    },

    // ── 見出し ──
    {
      title: '見出し',
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: '', styles: {} }],
        } as any);
      },
      aliases: ['heading', 'midashi', 'h2', '見出し'],
      group: GROUP_SECONDARY,
      subtext: 'レベル2の見出しを挿入',
    },
  ];
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * 議事録専用メニュー項目の全量を返す。
 * 優先グループ → 補助グループ の順で配列する。
 */
export function getMeetingMinutesSlashMenuItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
): DefaultReactSuggestionItem[] {
  return [
    ...getPrimaryItems(editor),
    ...getSecondaryItems(editor),
  ];
}

/**
 * 優先グループのメニュー項目タイトル一覧。
 */
export const PRIMARY_MENU_ITEM_TITLES = [
  '議題',
  '報告',
  '決定事項',
  'アクション',
  '連絡事項',
] as const;

/**
 * 補助グループのメニュー項目タイトル一覧。
 */
export const SECONDARY_MENU_ITEM_TITLES = [
  '継続検討',
  '次回予定',
  '箇条書き',
  'チェックリスト',
  '見出し',
] as const;

/**
 * 全メニュー項目のタイトル一覧（後方互換）。
 */
export const MEETING_MENU_ITEM_TITLES = [
  ...PRIMARY_MENU_ITEM_TITLES,
  ...SECONDARY_MENU_ITEM_TITLES,
] as const;

export type MeetingMenuItemTitle = (typeof MEETING_MENU_ITEM_TITLES)[number];
