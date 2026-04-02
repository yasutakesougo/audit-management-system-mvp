import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  SURVEY_TOKUSEI_CANDIDATES,
  SURVEY_TOKUSEI_ESSENTIALS,
} from '../surveyTokuseiFields';

describe('SURVEY_TOKUSEI_CANDIDATES drift', () => {
  const allFieldCandidates = SURVEY_TOKUSEI_CANDIDATES as unknown as Record<string, string[]>;

  function resolve(available: Set<string>) {
    return resolveInternalNamesDetailed(available, allFieldCandidates);
  }


  it('標準名がそのまま解決される（drift なし）', () => {
    const available = new Set([
      'Id', 'Title', 'ResponderName', 'RelationalDifficulties', 'SituationalUnderstanding'
    ]);
    const { resolved, missing, fieldStatus } = resolve(available);

    expect(resolved.responderName).toBe('ResponderName');
    expect(resolved.relationalDifficulties).toBe('RelationalDifficulties');
    const essentials = SURVEY_TOKUSEI_ESSENTIALS as unknown as string[];
    essentials.forEach(key => {
      expect(resolved[key]).toBeDefined();
      expect(missing).not.toContain(key);
    });
    expect(fieldStatus.responderName.isDrifted).toBe(false);
  });

  it('空白エンコード名 (_x0020_) が解決される (WARN)', () => {
    const available = new Set([
      'Id', 'Title', 'Responder_x0020_Name', 'Relational_x0020_Difficulties'
    ]);
    const { resolved, fieldStatus } = resolve(available);

    expect(resolved.responderName).toBe('Responder_x0020_Name');
    expect(resolved.relationalDifficulties).toBe('Relational_x0020_Difficulties');
    expect(fieldStatus.responderName.isDrifted).toBe(true);
  });

  it('必須フィールド (ResponderName) が揃えば isHealthy=true', () => {
    const available = new Set(['ResponderName']);
    const { resolved } = resolve(available);
    const essentials = SURVEY_TOKUSEI_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('ResponderName が欠落していれば isHealthy=false', () => {
    const available = new Set(['RelationalDifficulties']);
    const { resolved } = resolve(available);
    const essentials = SURVEY_TOKUSEI_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
