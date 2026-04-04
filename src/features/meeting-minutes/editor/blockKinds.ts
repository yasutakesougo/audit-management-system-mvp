/**
 * blockKinds.ts — 議事録カスタムブロック定義（BlockNote 拡張スキーマ）
 *
 * 責務:
 * - `decision` / `action` を正式な BlockNote カスタムブロックとして定義
 * - エディタ内で inline content 編集可能な状態を提供
 * - BlockNote スキーマにデフォルト blockSpecs と共に登録
 *
 * 設計判断:
 * - BlockNote の createReactBlockSpec / BlockNoteSchema.create を使用
 * - 各ブロックは `content: "inline"` でテキスト編集可能
 * - 見た目はシンプルなラベル + 左ボーダーで「意味付きブロック」を表現
 * - 将来 report / notification にも拡張可能
 */
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import React from 'react';

// ──────────────────────────────────────────────────────────────
// 定数
// ──────────────────────────────────────────────────────────────

/** 正式ブロック type の文字列定数 */
export const BLOCK_KIND = {
  decision: 'decision',
  action: 'action',
} as const;

export type BlockKind = (typeof BLOCK_KIND)[keyof typeof BLOCK_KIND];

// ──────────────────────────────────────────────────────────────
// Decision Block
// ──────────────────────────────────────────────────────────────

export const DecisionBlockSpec = createReactBlockSpec(
  {
    type: 'decision',
    propSchema: {},
    content: 'inline',
  },
  {
    render: ({ contentRef }) =>
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'stretch',
            gap: '8px',
            borderLeft: '4px solid #1976d2',
            paddingLeft: '12px',
            paddingTop: '4px',
            paddingBottom: '4px',
            minHeight: '1.5em',
          },
        },
        React.createElement(
          'span',
          {
            style: {
              fontSize: '12px',
              fontWeight: 700,
              color: '#1976d2',
              whiteSpace: 'nowrap',
              lineHeight: '1.8',
            },
          },
          '決定'
        ),
        React.createElement('div', {
          ref: contentRef,
          style: { flex: 1 },
        })
      ),
  }
);

// ──────────────────────────────────────────────────────────────
// Action Block
// ──────────────────────────────────────────────────────────────

export const ActionBlockSpec = createReactBlockSpec(
  {
    type: 'action',
    propSchema: {},
    content: 'inline',
  },
  {
    render: ({ contentRef }) =>
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'stretch',
            gap: '8px',
            borderLeft: '4px solid #ed6c02',
            paddingLeft: '12px',
            paddingTop: '4px',
            paddingBottom: '4px',
            minHeight: '1.5em',
          },
        },
        React.createElement(
          'span',
          {
            style: {
              fontSize: '12px',
              fontWeight: 700,
              color: '#ed6c02',
              whiteSpace: 'nowrap',
              lineHeight: '1.8',
            },
          },
          '対応'
        ),
        React.createElement('div', {
          ref: contentRef,
          style: { flex: 1 },
        })
      ),
  }
);

// ──────────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────────

/**
 * 議事録エディタ用の BlockNote スキーマ。
 * デフォルトブロック + decision + action を含む。
 */
export const meetingMinutesSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    decision: DecisionBlockSpec(),
    action: ActionBlockSpec(),
  },
});
