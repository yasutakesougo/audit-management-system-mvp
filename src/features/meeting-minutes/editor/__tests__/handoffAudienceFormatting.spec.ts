import { describe, expect, it } from 'vitest';
import { HANDOFF_FORMATTING_PRESETS } from '../handoffAudienceFormatting';

describe('handoffAudienceFormatting', () => {
  it('should define field preset correctly', () => {
    const preset = HANDOFF_FORMATTING_PRESETS.field;
    expect(preset.audience).toBe('field');
    expect(preset.joinStyle).toBe('compact');
    expect(preset.introText).toContain('現場申し送り');
    
    expect(preset.headings.summary).toBe('📝 要点メモ');
    expect(preset.headings.actions).toBe('📌 【対応】アクション');
  });

  it('should define admin preset correctly', () => {
    const preset = HANDOFF_FORMATTING_PRESETS.admin;
    expect(preset.audience).toBe('admin');
    expect(preset.joinStyle).toBe('spacious');
    expect(preset.introText).toContain('管理者共有');
    
    expect(preset.headings.summary).toBe('📄 【要約】議事録エグゼクティブサマリ');
    expect(preset.headings.actions).toBe('📌 【Next】アクション');
  });

  it('should define default preset correctly', () => {
    const preset = HANDOFF_FORMATTING_PRESETS.default;
    expect(preset.audience).toBe('default');
    expect(preset.joinStyle).toBe('compact');
    expect(preset.introText).toBeUndefined();
    
    expect(preset.headings.summary).toBe('■要点');
    expect(preset.headings.actions).toBe('■アクション');
  });
});
