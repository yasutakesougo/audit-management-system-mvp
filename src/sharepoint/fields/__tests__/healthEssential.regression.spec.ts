import { describe, it, expect } from 'vitest';
import { USER_BENEFIT_PROFILE_ESSENTIALS, USER_BENEFIT_PROFILE_EXT_ESSENTIALS } from '../userFields';
import { PLAN_GOAL_ESSENTIALS } from '../planGoalFields';

describe('Health Essential Schema Regression', () => {
  it('does not treat SharePoint standard Title as fatal key in essential field lists', () => {
    // これらのリストでは Title は必須契約（fatal）から除外されている必要がある
    // (HealthPage.tsx の skipTitleEssential ロジックと整合していること)
    
    // Note: 定数には 'userId' 等のキーが入っており、'Title' という文字列そのものは入っていないはず
    expect(USER_BENEFIT_PROFILE_ESSENTIALS).not.toContain('Title');
    expect(USER_BENEFIT_PROFILE_ESSENTIALS).not.toContain('title');
    
    expect(USER_BENEFIT_PROFILE_EXT_ESSENTIALS).not.toContain('Title');
    expect(USER_BENEFIT_PROFILE_EXT_ESSENTIALS).not.toContain('title');
    
    expect(PLAN_GOAL_ESSENTIALS).not.toContain('Title');
    expect(PLAN_GOAL_ESSENTIALS).not.toContain('title');
  });

  it('should have userId as essential for benefit lists (but Title is a fallback, not the key)', () => {
    expect(USER_BENEFIT_PROFILE_ESSENTIALS).toContain('userId');
    expect(USER_BENEFIT_PROFILE_EXT_ESSENTIALS).toContain('userId');
  });
});
