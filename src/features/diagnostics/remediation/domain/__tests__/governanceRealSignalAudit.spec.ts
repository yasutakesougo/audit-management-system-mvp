import { describe, it, expect, beforeEach } from 'vitest';
import { deriveGovernanceRecommendations } from '../governanceAdvisor';
import { GovernanceAuditStore } from '../governanceAuditStore';
import { SP_LIST_REGISTRY } from '@/sharepoint/spListRegistry';
import { type FieldSkipStreakResult } from '../../../drift/hooks/usePersistentDrift';

describe('Governance Real-Signal Audit (Acceptance Integrity)', () => {
  let store: GovernanceAuditStore;

  beforeEach(() => {
    store = GovernanceAuditStore.getInstance();
    (store as any).entries = []; 
  });

  const runDay = (day: number, signals: FieldSkipStreakResult[]) => {
    const recs = deriveGovernanceRecommendations(SP_LIST_REGISTRY, signals);
    for (const rec of recs) {
      store.logDecision({
        recommendationId: rec.id,
        reasonKey: `${rec.listKey}:${rec.targetField}`,
        listKey: rec.listKey,
        actionType: rec.action.type,
        recommendedAction: rec.action.label,
        confidence: rec.action.confidence,
        autoExecutable: rec.action.autoExecutable,
        priorityScore: rec.priority.score,
        priorityLevel: rec.priority.level,
        status: 'dry_run_passed',
        simulatedResult: 'passed'
      });
    }
    return recs;
  };

  it('Policy 1 & 2: 7日目の変位とマスタの自動修復権限の検証', () => {
    const masterDrift: FieldSkipStreakResult = {
      reasonKey: 'users_master:FullName',
      streak: 7, // 7日目
      status: 'persistent_drift'
    };

    const coreDrift: FieldSkipStreakResult = {
      reasonKey: 'daily_activity_records:RecordDate',
      streak: 7,
      status: 'persistent_drift'
    };

    const recs = runDay(7, [masterDrift, coreDrift]);
    
    const masterRec = recs.find(r => r.listKey === 'users_master');
    const coreRec = recs.find(r => r.listKey === 'daily_activity_records');

    // 1. 7日目で confidence が high にあがっていること
    expect(masterRec?.action.confidence).toBe('high');
    expect(coreRec?.action.confidence).toBe('high');

    // 2. 基幹マスタのみ autoExecutable=true であること
    expect(masterRec?.action.autoExecutable).toBe(true);
    expect(coreRec?.action.autoExecutable).toBe(false); // 基幹であってもマスタでなければ false
  });

  it('Policy 3: レジストリ外シグナルの完全排除', () => {
    const unknownDrift: FieldSkipStreakResult = {
      reasonKey: 'phantom_list:FieldA',
      streak: 10,
      status: 'persistent_drift'
    };

    const recs = runDay(10, [unknownDrift]);
    
    // 3. レジストリにないリストは推薦から除外されること
    expect(recs.length).toBe(0);
  });

  it('Policy 4: 低重要度ノイズの P2/P3 封じ込め', () => {
    const lowWeightDrift: FieldSkipStreakResult = {
      reasonKey: 'user_transport_settings:UserID',
      streak: 10, // 長期
      status: 'persistent_drift'
    };

    const recs = runDay(10, [lowWeightDrift]);
    const rec = recs[0];

    // 4. 重み1.0リストは長期(10回)でも P1(11点) を超えず、P2_HIGH に留まることを検証
    // Score = 4.0(structural) * 1.0(list) + 5.0(streak) = 9.0 (P2_HIGH)
    expect(rec.priority.level).toBe('P2_HIGH');
    expect(rec.priority.level).not.toBe('P1_CRITICAL');
  });
});
