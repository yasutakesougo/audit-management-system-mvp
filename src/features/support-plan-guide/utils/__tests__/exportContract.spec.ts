import { describe, it, expect } from 'vitest';
import { createEmptyForm } from '../helpers';
import { toExportModel, isIbdActive } from '../exportTransformers';
import { validateExportContract } from '../exportValidation';
import { FIELD_LIMITS } from '../../types';

describe('Export Contract Logic', () => {
  const mockDraft = {
    id: 'd-1',
    name: 'Draft User',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    data: {
      ...createEmptyForm(),
      serviceUserName: 'Test User',
      supportLevel: '区分4 (強度含む)',
      planPeriod: '2026/04 - 2026/09',
      assessmentSummary: 'Some assessment',
      decisionSupport: 'Support text',
      monitoringPlan: 'Monthly',
      riskManagement: 'Safety first',
      rightsAdvocacy: '身体拘束は行いません。',
      goals: [
        { id: '1', type: 'long', text: 'Goal 1', label: '', domains: [] },
        { id: '2', type: 'long', text: 'Goal 2', label: '', domains: [] },
        { id: '3', type: 'long', text: 'Goal 3', label: '', domains: [] }, // Excess
      ],
    },
  };

  it('isIbdActive should return true if level contains "強度"', () => {
    const form = { ...createEmptyForm(), supportLevel: '強度ターゲット' };
    expect(isIbdActive(form)).toBe(true);
  });

  it('toExportModel should flatten goals and respect top 2 limit', () => {
    const validation = validateExportContract(mockDraft.data as any);
    const model = toExportModel(mockDraft as any, validation);

    expect(model.coreIsp.serviceUserName).toBe('Test User');
    expect(model.goals.longGoals.length).toBe(2);
    expect(model.goals.longGoals[0]).toBe('Goal 1');
    expect(model.goals.longGoals[1]).toBe('Goal 2');
    expect(model.ibd.enabled).toBe(true);
  });

  it('validateExportContract should block if required field is empty', () => {
    const invalidForm = { ...createEmptyForm(), serviceUserName: '' };
    const result = validateExportContract(invalidForm);
    
    expect(result.isExportable).toBe(false);
    expect(result.blockCount).toBeGreaterThan(0);
    const nameIssue = result.issues.find(i => i.field === 'serviceUserName');
    expect(nameIssue?.severity).toBe('block');
  });

  it('validateExportContract should warn if character limit is exceeded', () => {
    const form = { 
      ...createEmptyForm(), 
      serviceUserName: 'A'.repeat(FIELD_LIMITS.serviceUserName + 1) 
    };
    const result = validateExportContract(form);
    
    const issue = result.issues.find(i => i.field === 'serviceUserName');
    expect(issue?.severity).toBe('warn');
    expect(issue?.message).toContain('制限');
  });

  it('validateExportContract should warn if goals exceed limit', () => {
    const result = validateExportContract(mockDraft.data as any);
    const goalIssue = result.issues.find(i => i.field === 'goals');
    expect(goalIssue?.severity).toBe('warn');
    expect(goalIssue?.message).toContain('3件以上');
  });
});
