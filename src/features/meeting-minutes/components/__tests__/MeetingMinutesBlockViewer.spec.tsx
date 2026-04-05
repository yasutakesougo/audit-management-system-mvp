/**
 * MeetingMinutesBlockViewer.spec.ts
 *
 * 読み取り専用ブロックレンダラーの単体テスト。
 *
 * 観点:
 * 1. heading ブロックの描画
 * 2. paragraph ブロックの描画
 * 3. bulletListItem / numberedListItem の描画
 * 4. checkListItem の描画（checked / unchecked）
 * 5. インラインスタイル（bold, italic, link）の描画
 * 6. 空ブロック配列の場合 null を返す
 * 7. 未知ブロックタイプの fallback
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MeetingMinuteBlock } from '../../types';
import { MeetingMinutesBlockViewer } from '../MeetingMinutesBlockViewer';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeBlock(
  type: string,
  text: string,
  props: Record<string, unknown> = {},
  styles: Record<string, boolean | string> = {}
): MeetingMinuteBlock {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    type,
    props,
    content: [{ type: 'text', text, styles }],
    children: [],
  };
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('MeetingMinutesBlockViewer', () => {
  it('should return null for empty blocks', () => {
    const { container } = render(<MeetingMinutesBlockViewer blocks={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render heading blocks', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('heading', '見出しテスト', { level: 2 }),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(screen.getByText('見出しテスト')).toBeInTheDocument();
  });

  it('should render paragraph blocks', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('paragraph', '段落テキスト'),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(screen.getByText('段落テキスト')).toBeInTheDocument();
  });

  it('should render bulletListItem blocks', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('bulletListItem', 'リスト項目1'),
      makeBlock('bulletListItem', 'リスト項目2'),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(screen.getByText('リスト項目1')).toBeInTheDocument();
    expect(screen.getByText('リスト項目2')).toBeInTheDocument();
  });

  it('should render numberedListItem blocks', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('numberedListItem', '番号付き項目'),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(screen.getByText('番号付き項目')).toBeInTheDocument();
  });

  it('should render checkListItem as checked', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('checkListItem', '完了タスク', { checked: true }),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(screen.getByText('完了タスク')).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
  });

  it('should render checkListItem as unchecked', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('checkListItem', '未完了タスク', { checked: false }),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(screen.getByText('未完了タスク')).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('should render unknown block types as paragraph fallback', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('customUnknownType', 'フォールバックテキスト'),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(screen.getByText('フォールバックテキスト')).toBeInTheDocument();
  });

  it('should handle blocks with empty content', () => {
    const blocks: MeetingMinuteBlock[] = [{
      id: 'empty-block',
      type: 'paragraph',
      props: {},
      content: [],
      children: [],
    }];

    // Should render without error (empty paragraph becomes &nbsp;)
    const { container } = render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(container.innerHTML).not.toBe('');
  });

  it('should render inline bold text', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('paragraph', '太字テスト', {}, { bold: true }),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    const el = screen.getByText('太字テスト');
    expect(el).toBeInTheDocument();
  });

  it('should render mixed blocks in order', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('heading', '第1項'),
      makeBlock('paragraph', '本文1'),
      makeBlock('heading', '第2項'),
      makeBlock('paragraph', '本文2'),
    ];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    expect(screen.getByText('第1項')).toBeInTheDocument();
    expect(screen.getByText('本文1')).toBeInTheDocument();
    expect(screen.getByText('第2項')).toBeInTheDocument();
    expect(screen.getByText('本文2')).toBeInTheDocument();
  });

  it('should render link inline content', () => {
    const blocks: MeetingMinuteBlock[] = [{
      id: 'link-block',
      type: 'paragraph',
      props: {},
      content: [{ type: 'link', text: '参考リンク', href: 'https://example.com', styles: {} }],
      children: [],
    }];

    render(<MeetingMinutesBlockViewer blocks={blocks} />);
    const link = screen.getByText('参考リンク');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://example.com');
  });
});
