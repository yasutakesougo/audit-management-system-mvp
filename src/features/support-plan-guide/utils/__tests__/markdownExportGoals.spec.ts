/**
 * markdownExport — Phase 5 ゴール出力テスト
 *
 * buildMarkdown() が goals のみを出力ソースとして
 * 正しく Markdown を生成することを検証する。
 */
import { describe, expect, it } from 'vitest';
import type { SupportPlanForm } from '../../types';
import { defaultFormState } from '../../types';
import { buildMarkdown } from '../markdownExport';

const makeForm = (overrides: Partial<SupportPlanForm>): SupportPlanForm => ({
  ...defaultFormState,
  ...overrides,
});

describe('buildMarkdown — goals のみ出力', () => {
  it('goals が存在する場合、構造化データが見出し付きで展開される', () => {
    const form = makeForm({
      goals: [
        { id: '1', type: 'long', label: '長期A', text: '自立生活を目指す', domains: [] },
        { id: '2', type: 'short', label: '短期A', text: '週3回の参加', domains: [] },
        { id: '3', type: 'short', label: '短期B', text: '挨拶を習慣化', domains: [] },
      ],
    });
    const md = buildMarkdown(form);
    expect(md).toContain('### 長期目標');
    expect(md).toContain('**長期A**: 自立生活を目指す');
    expect(md).toContain('### 短期目標');
    expect(md).toContain('**短期A**: 週3回の参加');
    expect(md).toContain('**短期B**: 挨拶を習慣化');
  });

  it('support goals が支援内容セクションに展開される', () => {
    const form = makeForm({
      goals: [
        { id: '1', type: 'support', label: '日中支援', text: '入浴介助', domains: [] },
      ],
    });
    const md = buildMarkdown(form);
    expect(md).toContain('**日中支援**: 入浴介助');
  });

  it('goals が空の場合、目標セクションが省略される', () => {
    const form = makeForm({});
    const md = buildMarkdown(form);
    expect(md).not.toContain('### 長期目標');
    expect(md).not.toContain('### 短期目標');
  });

  it('他のセクション（基本情報等）は正常に出力される', () => {
    const form = makeForm({
      serviceUserName: '山田太郎',
      supportLevel: '支援区分4',
    });
    const md = buildMarkdown(form);
    expect(md).toContain('利用者名: 山田太郎');
    expect(md).toContain('支援区分 / 医療等: 支援区分4');
  });
});
