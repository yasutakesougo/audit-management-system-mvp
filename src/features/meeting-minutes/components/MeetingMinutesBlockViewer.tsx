/**
 * MeetingMinutesBlockViewer — ブロック配列の読み取り専用レンダラー
 *
 * 責務:
 * - MeetingMinuteBlock[] を MUI コンポーネントで描画する
 * - BlockNote エディタを読み込まない軽量実装
 * - heading / paragraph / bulletListItem / numberedListItem / checkListItem に対応
 *
 * 設計判断:
 * DetailPage に BlockNote エディタ (read-only) をロードすると
 * バンドルサイズ・初期化コストが大きいため、
 * 独自の軽量レンダラーで MUI スタイルに統一する。
 */
import { Box, Checkbox, Stack, Typography } from '@mui/material';

import type { MeetingMinuteBlock } from '../types';

// ──────────────────────────────────────────────────────────────
// Content 抽出ヘルパー
// ──────────────────────────────────────────────────────────────

type InlineContent = {
  type: string;
  text: string;
  styles?: Record<string, boolean | string>;
  href?: string;
};

/**
 * block.content 配列からインラインコンテンツを型安全に抽出する。
 */
function extractInlineContent(content: unknown[] | undefined): InlineContent[] {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (c): c is InlineContent =>
      typeof c === 'object' &&
      c !== null &&
      'type' in c &&
      typeof (c as Record<string, unknown>).type === 'string'
  );
}

/**
 * InlineContent 配列をプレーンテキストに変換する（空チェック用）。
 */
function inlineToText(inlines: InlineContent[]): string {
  return inlines.map((c) => c.text ?? '').join('');
}

// ──────────────────────────────────────────────────────────────
// Inline Renderer
// ──────────────────────────────────────────────────────────────

/**
 * インラインコンテンツ（テキスト、リンク）を
 * スタイル付きの <span> / <a> としてレンダリングする。
 */
function InlineRenderer(props: { content: InlineContent[] }) {
  const { content } = props;

  return (
    <>
      {content.map((item, idx) => {
        const key = `${item.text}-${idx}`;
        const styles = item.styles ?? {};

        const sx: Record<string, unknown> = {};
        if (styles.bold) sx.fontWeight = 700;
        if (styles.italic) sx.fontStyle = 'italic';
        if (styles.underline) sx.textDecoration = 'underline';
        if (styles.strikethrough) {
          sx.textDecoration = sx.textDecoration
            ? `${sx.textDecoration} line-through`
            : 'line-through';
        }
        if (styles.code) {
          sx.fontFamily = 'monospace';
          sx.bgcolor = 'grey.100';
          sx.px = 0.5;
          sx.py = 0.25;
          sx.borderRadius = 0.5;
          sx.fontSize = '0.85em';
        }

        const text = item.text ?? '';

        if (item.type === 'link' && item.href) {
          return (
            <Box
              key={key}
              component="a"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'primary.main',
                textDecoration: 'underline',
                ...sx,
              }}
            >
              {text}
            </Box>
          );
        }

        if (Object.keys(sx).length === 0) {
          return <span key={key}>{text}</span>;
        }

        return (
          <Box key={key} component="span" sx={sx}>
            {text}
          </Box>
        );
      })}
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Block-level Renderers
// ──────────────────────────────────────────────────────────────

function HeadingBlock(props: { block: MeetingMinuteBlock }) {
  const { block } = props;
  const level = typeof block.props.level === 'number' ? block.props.level : 2;
  const inlines = extractInlineContent(block.content);

  // MUI variant mapping: level 1→h5, 2→h6, 3→subtitle1
  const variant = level === 1 ? 'h5' : level === 2 ? 'h6' : 'subtitle1';

  return (
    <Typography
      variant={variant}
      sx={{
        fontWeight: 600,
        mt: 1.5,
        mb: 0.5,
        borderBottom: level <= 2 ? '1px solid' : 'none',
        borderColor: 'divider',
        pb: level <= 2 ? 0.5 : 0,
      }}
    >
      <InlineRenderer content={inlines} />
    </Typography>
  );
}

function ParagraphBlock(props: { block: MeetingMinuteBlock }) {
  const { block } = props;
  const inlines = extractInlineContent(block.content);
  const text = inlineToText(inlines);

  // 完全に空の行は高さを保持するため改行スペースを表示
  if (!text.trim()) {
    return <Typography variant="body2" sx={{ minHeight: '1.5em' }}>&nbsp;</Typography>;
  }

  return (
    <Typography variant="body2" color="text.secondary">
      <InlineRenderer content={inlines} />
    </Typography>
  );
}

function BulletListItemBlock(props: { block: MeetingMinuteBlock }) {
  const { block } = props;
  const inlines = extractInlineContent(block.content);

  return (
    <Box component="li" sx={{ listStyleType: 'disc', ml: 3, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary" component="span">
        <InlineRenderer content={inlines} />
      </Typography>
    </Box>
  );
}

function NumberedListItemBlock(props: { block: MeetingMinuteBlock }) {
  const { block } = props;
  const inlines = extractInlineContent(block.content);

  return (
    <Box component="li" sx={{ listStyleType: 'decimal', ml: 3, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary" component="span">
        <InlineRenderer content={inlines} />
      </Typography>
    </Box>
  );
}

function CheckListItemBlock(props: { block: MeetingMinuteBlock }) {
  const { block } = props;
  const inlines = extractInlineContent(block.content);
  const checked = block.props.checked === true;

  return (
    <Stack direction="row" alignItems="flex-start" spacing={0.5} sx={{ py: 0.25 }}>
      <Checkbox
        checked={checked}
        size="small"
        disabled
        sx={{ p: 0, mt: 0.25 }}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={checked ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
      >
        <InlineRenderer content={inlines} />
      </Typography>
    </Stack>
  );
}

function DecisionBlock(props: { block: MeetingMinuteBlock }) {
  const { block } = props;
  const inlines = extractInlineContent(block.content);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 1,
        borderLeft: '4px solid',
        borderColor: 'primary.main',
        pl: 1.5,
        py: 0.5,
        my: 0.5,
        minHeight: '1.5em',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: 'primary.main',
          whiteSpace: 'nowrap',
          lineHeight: 1.8,
        }}
      >
        決定
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        <InlineRenderer content={inlines} />
      </Typography>
    </Box>
  );
}

function ActionBlock(props: { block: MeetingMinuteBlock }) {
  const { block } = props;
  const inlines = extractInlineContent(block.content);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 1,
        borderLeft: '4px solid',
        borderColor: 'warning.main', // #ed6c02 in MUI
        pl: 1.5,
        py: 0.5,
        my: 0.5,
        minHeight: '1.5em',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: 'warning.main',
          whiteSpace: 'nowrap',
          lineHeight: 1.8,
        }}
      >
        対応
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        <InlineRenderer content={inlines} />
      </Typography>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────
// Block Router
// ──────────────────────────────────────────────────────────────

function BlockRenderer(props: { block: MeetingMinuteBlock }) {
  const { block } = props;

  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} />;
    case 'paragraph':
      return <ParagraphBlock block={block} />;
    case 'bulletListItem':
      return <BulletListItemBlock block={block} />;
    case 'numberedListItem':
      return <NumberedListItemBlock block={block} />;
    case 'checkListItem':
      return <CheckListItemBlock block={block} />;
    case 'decision':
      return <DecisionBlock block={block} />;
    case 'action':
      return <ActionBlock block={block} />;
    default:
      // 未知のブロックタイプはパラグラフとして表示
      return <ParagraphBlock block={block} />;
  }
}

// ──────────────────────────────────────────────────────────────
// Public: Viewer コンポーネント
// ──────────────────────────────────────────────────────────────

export type MeetingMinutesBlockViewerProps = {
  blocks: MeetingMinuteBlock[];
};

/**
 * MeetingMinuteBlock[] を読み取り専用で描画する。
 * 空の場合は null を返す（呼び出し側で fallback 表示を制御する）。
 */
export function MeetingMinutesBlockViewer(props: MeetingMinutesBlockViewerProps) {
  const { blocks } = props;

  if (!blocks || blocks.length === 0) return null;

  return (
    <Stack spacing={0.5}>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </Stack>
  );
}
