/**
 * blockMappers.ts — Block ↔ Legacy テキスト変換ユーティリティ
 *
 * 責務:
 * 1. 旧データ (summary/decisions/actions) → ブロック配列への変換
 * 2. ブロック配列 → 旧データテキストへの逆変換
 *
 * ブロックエディタ導入の backward compatibility を保証するための
 * 双方向マッパー。Repository 層およびフォーム初期化で使用される。
 */
import type { MeetingMinuteBlock } from '../types';
import { MEETING_PREFIX } from './slashMenuItems';

// ──────────────────────────────────────────────────────────────
// ID生成用ユーティリティ
// ──────────────────────────────────────────────────────────────

let blockIdCounter = 0;

function generateBlockId(): string {
  blockIdCounter += 1;
  return `block-${Date.now()}-${blockIdCounter}`;
}

// ──────────────────────────────────────────────────────────────
// テキスト → ブロック変換ヘルパー
// ──────────────────────────────────────────────────────────────

/**
 * プレーンテキストの行を paragraph ブロック配列に変換する。
 * 空行はスキップせず、空 paragraph として保持する。
 */
function textToBlocks(text: string): MeetingMinuteBlock[] {
  if (!text.trim()) return [];
  return text.split('\n').map((line) => ({
    id: generateBlockId(),
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: line, styles: {} }],
    children: [],
  }));
}

/**
 * セクション見出し（heading level 2）のブロックを生成する。
 */
function headingBlock(text: string): MeetingMinuteBlock {
  return {
    id: generateBlockId(),
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  };
}

// ──────────────────────────────────────────────────────────────
// Public: Legacy → Blocks 変換
// ──────────────────────────────────────────────────────────────

/**
 * 旧形式の summary / decisions / actions テキストから
 * ブロック配列を生成する。セクション見出し付き。
 */
export function buildFallbackBlocksFromLegacyFields(fields: {
  summary: string;
  decisions: string;
  actions: string;
}): MeetingMinuteBlock[] {
  const blocks: MeetingMinuteBlock[] = [];

  if (fields.summary.trim()) {
    blocks.push(headingBlock('要点'));
    blocks.push(...textToBlocks(fields.summary));
  }

  if (fields.decisions.trim()) {
    blocks.push(headingBlock('決定事項'));
    blocks.push(...textToBlocks(fields.decisions));
  }

  if (fields.actions.trim()) {
    blocks.push(headingBlock('アクション'));
    blocks.push(...textToBlocks(fields.actions));
  }

  return blocks;
}

// ──────────────────────────────────────────────────────────────
// Public: Blocks → Legacy テキスト変換
// ──────────────────────────────────────────────────────────────

/**
 * ブロック配列からプレーンテキストを抽出する。
 * content 配列内の text プロパティを連結し、行ごとに改行で結合する。
 */
function extractTextFromBlocks(blocks: MeetingMinuteBlock[]): string {
  return blocks
    .map((block) => {
      const contentTexts = Array.isArray(block.content)
        ? block.content
            .filter(
              (c): c is { type: string; text: string } =>
                typeof c === 'object' &&
                c !== null &&
                'text' in c &&
                typeof (c as Record<string, unknown>).text === 'string'
            )
            .map((c) => c.text)
            .join('')
        : '';
      return contentTexts;
    })
    .join('\n');
}

/**
 * ブロック配列をセクション見出しで分割し、
 * 指定セクション名に該当するブロックのテキストを返す。
 *
 * セクション見出しが見つからない場合は全ブロックのテキストを結合して返す。
 */
function extractSectionText(
  blocks: MeetingMinuteBlock[],
  sectionLabels: string[]
): string {
  const lowerLabels = sectionLabels.map((l) => l.toLowerCase());

  // セクション見出しの開始位置を探す
  const sectionRanges: { start: number; end: number }[] = [];
  let currentStart = -1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'heading') {
      const headingText = extractTextFromBlocks([block]).trim().toLowerCase();
      if (lowerLabels.includes(headingText)) {
        currentStart = i + 1; // 見出し直後から
      } else if (currentStart >= 0) {
        // 別の見出しが来たらセクション終了
        sectionRanges.push({ start: currentStart, end: i });
        currentStart = -1;
      }
    }
  }
  // 最後のセクション
  if (currentStart >= 0) {
    sectionRanges.push({ start: currentStart, end: blocks.length });
  }

  if (sectionRanges.length === 0) return '';

  const sectionBlocks = sectionRanges.flatMap((r) =>
    blocks.slice(r.start, r.end)
  );
  return extractTextFromBlocks(sectionBlocks).trim();
}

/**
 * ブロック配列から、指定 prefix（【決定事項】等）で始まるブロックの
 * テキストを抽出する。prefix 自体は除去して返す。
 */
function extractPrefixedText(
  blocks: MeetingMinuteBlock[],
  prefixes: string[]
): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const text = extractTextFromBlocks([block]);
    for (const prefix of prefixes) {
      if (text.startsWith(prefix)) {
        const content = text.slice(prefix.length).trim();
        if (content) lines.push(content);
        break;
      }
    }
  }

  return lines.join('\n');
}

/**
 * ブロック配列から summary テキストを抽出する。
 * 「要点」「Summary」セクションを探し、見つからなければ全テキストを返す。
 */
export function buildSummaryText(blocks: MeetingMinuteBlock[]): string {
  const result = extractSectionText(blocks, ['要点', 'Summary', '概要']);
  if (result) return result;
  // セクション構造なしの場合はフルテキストを fallback
  return extractTextFromBlocks(blocks).trim();
}

/**
 * ブロック配列から decisions テキストを抽出する。
 */
export function buildDecisionsText(blocks: MeetingMinuteBlock[]): string {
  // formal block type base:
  const typeBase = blocks
    .filter((b) => b.type === 'decision')
    .map((b) => extractTextFromBlocks([b]).trim())
    .filter((t) => t.length > 0);
  if (typeBase.length > 0) return typeBase.join('\n');

  // 1. セクション見出しベース
  const fromSection = extractSectionText(blocks, ['決定事項', 'Decisions']);
  if (fromSection) return fromSection;
  // 2. prefix ベース
  return extractPrefixedText(blocks, [MEETING_PREFIX.decision]);
}

/**
 * ブロック配列から actions テキストを抽出する。
 */
export function buildActionsText(blocks: MeetingMinuteBlock[]): string {
  // formal block type base:
  const typeBase = blocks
    .filter((b) => b.type === 'action')
    .map((b) => extractTextFromBlocks([b]).trim())
    .filter((t) => t.length > 0);
  if (typeBase.length > 0) return typeBase.join('\n');

  // 1. セクション見出しベース
  const fromSection = extractSectionText(blocks, ['アクション', 'Actions']);
  if (fromSection) return fromSection;
  // 2. checkListItem からの抽出（アクションは checklist 形式も対応）
  const checkItems = blocks
    .filter((b) => b.type === 'checkListItem')
    .map((b) => extractTextFromBlocks([b]).trim())
    .filter((t) => t.length > 0);
  if (checkItems.length > 0) return checkItems.join('\n');
  return '';
}

/**
 * ブロック配列全体をプレーンテキストに変換する。
 * 見出しブロックも含めたフルテキスト出力。
 */
export function blocksToPlainText(blocks: MeetingMinuteBlock[]): string {
  return extractTextFromBlocks(blocks).trim();
}
