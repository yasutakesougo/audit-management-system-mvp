import { describe, it, expect } from 'vitest';
import { getPlaybookEntry, ALERT_PLAYBOOK } from '../alertPlaybook';

describe('alertPlaybook', () => {
  // ── exact match ──

  it('全体 alert ID で exact match', () => {
    const entry = getPlaybookEntry('hero-rate-low');
    expect(entry).toBeDefined();
    expect(entry!.alertId).toBe('hero-rate-low');
    expect(entry!.causes.length).toBeGreaterThan(0);
    expect(entry!.checkpoints.length).toBeGreaterThan(0);
    expect(entry!.relatedScreens.length).toBeGreaterThan(0);
    expect(entry!.issueTemplate.title).toBeTruthy();
    expect(entry!.issueTemplate.labels.length).toBeGreaterThan(0);
  });

  it('role 別 alert ID で exact match', () => {
    const entry = getPlaybookEntry('role-hero-rate-low:staff');
    expect(entry).toBeDefined();
    expect(entry!.alertId).toBe('role-hero-rate-low:staff');
    expect(entry!.causes.length).toBeGreaterThan(0);
  });

  it('admin の role alert で exact match', () => {
    const entry = getPlaybookEntry('role-completion-low:admin');
    expect(entry).toBeDefined();
    expect(entry!.causes.some((c) => c.includes('承認'))).toBe(true);
  });

  // ── フォールバック ──

  it('role付きIDで未登録の場合、base IDにフォールバック', () => {
    // role-hero-rate-low:unknown は登録なし → hero-rate-low にフォールバック
    const entry = getPlaybookEntry('role-hero-rate-low:unknown');
    // unknown の exact match があるかどうかに依存しないフォールバックロジック確認
    expect(entry).toBeDefined();
  });

  it('完全に未知の alert ID では undefined', () => {
    const entry = getPlaybookEntry('totally-unknown-alert');
    expect(entry).toBeUndefined();
  });

  // ── データ整合性 ──

  it('全エントリが必須フィールドを持つ', () => {
    for (const [id, entry] of Object.entries(ALERT_PLAYBOOK)) {
      expect(entry.alertId).toBe(id);
      expect(entry.causes.length).toBeGreaterThan(0);
      expect(entry.checkpoints.length).toBeGreaterThan(0);
      expect(entry.relatedScreens.length).toBeGreaterThan(0);
      expect(entry.issueTemplate.title).toBeTruthy();
      expect(entry.issueTemplate.labels.length).toBeGreaterThan(0);
    }
  });

  it('issueTemplate.labels に telemetry ラベルが含まれる', () => {
    for (const entry of Object.values(ALERT_PLAYBOOK)) {
      expect(entry.issueTemplate.labels).toContain('telemetry');
    }
  });

  it('unknown-role-share-high が data-quality ラベルを持つ', () => {
    const entry = getPlaybookEntry('unknown-role-share-high');
    expect(entry).toBeDefined();
    expect(entry!.issueTemplate.labels).toContain('data-quality');
  });

  it('critical な alert の issueTemplate に critical ラベルが含まれる', () => {
    // completion-low は critical
    const entry = getPlaybookEntry('completion-low');
    expect(entry!.issueTemplate.labels).toContain('critical');

    const staffEntry = getPlaybookEntry('role-completion-low:staff');
    expect(staffEntry!.issueTemplate.labels).toContain('critical');
  });

  // ── role 別の内容差異 ──

  it('staff と admin の completion-low で causes が異なる', () => {
    const staff = getPlaybookEntry('role-completion-low:staff');
    const admin = getPlaybookEntry('role-completion-low:admin');
    expect(staff).toBeDefined();
    expect(admin).toBeDefined();
    expect(staff!.causes).not.toEqual(admin!.causes);
  });

  it('staff と admin の hero-rate-low で relatedScreens が異なる', () => {
    const staff = getPlaybookEntry('role-hero-rate-low:staff');
    const admin = getPlaybookEntry('role-hero-rate-low:admin');
    expect(staff).toBeDefined();
    expect(admin).toBeDefined();
    expect(staff!.relatedScreens).not.toEqual(admin!.relatedScreens);
  });
});
