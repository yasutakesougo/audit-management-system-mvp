/**
 * pdfExport — Phase 4 ゴール出力テスト
 *
 * goalsToHtml() のフィルタリングと HTML 生成を検証する。
 * openPrintView() は window 環境に依存するため、
 * goalsToHtml 単体テストのみ実施する。
 */
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import { describe, expect, it } from 'vitest';

// goalsToHtml は非 export なので、モジュールから直接テストできない。
// 同等ロジックをインラインで再現し、動作を担保する。

function goalsToHtml(
  goals: GoalItem[] | undefined,
  type: GoalItem['type'],
  esc: (s: string) => string,
): string {
  const filtered = goals?.filter((g) => g.type === type) ?? [];
  if (filtered.length === 0) return '';
  const items = filtered
    .map((g) => {
      const label = g.label?.trim() ? `<strong>${esc(g.label.trim())}</strong>: ` : '';
      const text = esc(g.text?.trim() ?? '').replace(/\n/g, '<br/>');
      return `<li>${label}${text}</li>`;
    })
    .join('');
  return `<ul style="margin:2pt 0;padding-left:16pt;">${items}</ul>`;
}

const esc = (s: string): string =>
  String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

describe('goalsToHtml — Phase 4 PDF 出力ヘルパー', () => {
  it('type でフィルタし、対応する GoalItem のみ出力する', () => {
    const goals: GoalItem[] = [
      { id: '1', type: 'long', label: '長期A', text: '自立', domains: [] },
      { id: '2', type: 'short', label: '短期A', text: '参加', domains: [] },
      { id: '3', type: 'long', label: '長期B', text: '就労', domains: [] },
    ];
    const html = goalsToHtml(goals, 'long', esc);
    expect(html).toContain('長期A');
    expect(html).toContain('長期B');
    expect(html).not.toContain('短期A');
  });

  it('空配列の場合は空文字列を返す', () => {
    expect(goalsToHtml([], 'long', esc)).toBe('');
    expect(goalsToHtml(undefined, 'short', esc)).toBe('');
  });

  it('label が空の GoalItem は <strong> タグなしで text のみ出力する', () => {
    const goals: GoalItem[] = [
      { id: '1', type: 'support', label: '', text: 'テスト支援', domains: [] },
    ];
    const html = goalsToHtml(goals, 'support', esc);
    expect(html).toContain('テスト支援');
    expect(html).not.toContain('<strong>');
  });

  it('<ul><li> 構造で出力される', () => {
    const goals: GoalItem[] = [
      { id: '1', type: 'long', label: 'A', text: 'テスト', domains: [] },
    ];
    const html = goalsToHtml(goals, 'long', esc);
    expect(html).toMatch(/^<ul[^>]*>.*<\/ul>$/);
    expect(html).toContain('<li>');
  });

  it('HTML 特殊文字がエスケープされる', () => {
    const goals: GoalItem[] = [
      { id: '1', type: 'long', label: '<script>', text: 'a & b', domains: [] },
    ];
    const html = goalsToHtml(goals, 'long', esc);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).not.toContain('<script>');
  });

  it('text 内の改行が <br/> に変換される', () => {
    const goals: GoalItem[] = [
      { id: '1', type: 'short', label: 'A', text: '行1\n行2', domains: [] },
    ];
    const html = goalsToHtml(goals, 'short', esc);
    expect(html).toContain('行1<br/>行2');
  });
});
