import { describe, expect, it } from 'vitest';
import { HANDOFF_TEMPLATES } from '../handoffTemplates';

describe('handoffTemplates', () => {
  it('should define field template correctly', () => {
    const template = HANDOFF_TEMPLATES.field;
    expect(template.audience).toBe('field');
    expect(template.label).toBe('現場申し送り');
    
    // Check default selection
    expect(template.defaultSelection.includeSummary).toBe(false);
    expect(template.defaultSelection.includeReports).toBe(false);
    expect(template.defaultSelection.includeDecisions).toBe(true);
    expect(template.defaultSelection.includeActions).toBe(true);
    expect(template.defaultSelection.includeNotifications).toBe(true);

    // Check ordering
    expect(template.sectionOrder).toEqual(['actions', 'notifications', 'decisions', 'reports', 'summary']);
  });

  it('should define admin template correctly', () => {
    const template = HANDOFF_TEMPLATES.admin;
    expect(template.audience).toBe('admin');
    expect(template.label).toBe('管理者共有');
    
    // Check default selection
    expect(template.defaultSelection.includeSummary).toBe(true);
    expect(template.defaultSelection.includeReports).toBe(true);
    expect(template.defaultSelection.includeDecisions).toBe(true);
    expect(template.defaultSelection.includeActions).toBe(true);
    expect(template.defaultSelection.includeNotifications).toBe(true);

    // Check ordering
    expect(template.sectionOrder).toEqual(['summary', 'reports', 'decisions', 'actions', 'notifications']);
  });
});
