/**
 * Lot1B PR #E — DataProviderUserRepository cutover integration tests.
 *
 * 5-stage cutover (PRE_MIGRATION → DUAL_WRITE → BACKFILL_IN_PROGRESS →
 * READ_CUTOVER → WRITE_CUTOVER) の read/write 挙動をリポジトリ統合レベルで検証する。
 *
 * 対象列: UserBenefit_Profile 内 optional 6列 (rename-migrate)
 *   - GrantMunicipality <-> Grant_x0020_Municipality
 *   - GrantPeriodStart  <-> Grant_x0020_Period_x0020_Start
 *   - GrantPeriodEnd    <-> Grant_x0020_Period_x0020_End
 *   - MealAddition      <-> Meal_x0020_Addition
 *   - UserCopayLimit    <-> User_x0020_Copay_x0020_Limit
 *   - CopayPaymentMethod<-> Copay_x0020_Payment_x0020_Method
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DataProviderUserRepository } from '../DataProviderUserRepository';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';

const BENEFIT_LIST = 'UserBenefit_Profile';

describe('DataProviderUserRepository — benefit cutover overlay', () => {
  let provider: InMemoryDataProvider;
  let repo: DataProviderUserRepository;

  beforeEach(() => {
    provider = new InMemoryDataProvider();
    repo = new DataProviderUserRepository({ provider });
  });

  // ── CUTOVER STEP 1: dual-write ──────────────────────────────────────────
  describe('WRITE — DUAL_WRITE stage', () => {
    it('writes both canonical and legacy columns when no existing benefit row', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Dual Write' }]);
      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');

      await repo.update(1, { GrantMunicipality: 'Yokohama' });

      const benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit).toHaveLength(1);
      expect(benefit[0].UserID).toBe('U-001');
      expect(benefit[0].GrantMunicipality).toBe('Yokohama');
      expect(benefit[0].Grant_x0020_Municipality).toBe('Yokohama');
    });

    it('updates both canonical and legacy columns when benefit row exists', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Existing' }]);
      await provider.seed(BENEFIT_LIST, [
        {
          Id: 10,
          UserID: 'U-001',
          Grant_x0020_Municipality: 'old-city',
        },
      ]);
      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');

      await repo.update(1, { GrantMunicipality: 'Kawasaki' });

      const benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit).toHaveLength(1);
      expect(benefit[0].GrantMunicipality).toBe('Kawasaki');
      expect(benefit[0].Grant_x0020_Municipality).toBe('Kawasaki');
    });

    it('dual-writes multiple migrating columns in a single update', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Multi' }]);
      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');

      await repo.update(1, {
        GrantMunicipality: 'Yokohama',
        GrantPeriodStart: '2026-04-01',
        GrantPeriodEnd: '2027-03-31',
        MealAddition: 'I',
        UserCopayLimit: '37200',
        CopayPaymentMethod: 'bank',
      });

      const benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit[0]).toMatchObject({
        GrantMunicipality: 'Yokohama',
        Grant_x0020_Municipality: 'Yokohama',
        GrantPeriodStart: '2026-04-01',
        Grant_x0020_Period_x0020_Start: '2026-04-01',
        GrantPeriodEnd: '2027-03-31',
        Grant_x0020_Period_x0020_End: '2027-03-31',
        MealAddition: 'I',
        Meal_x0020_Addition: 'I',
        UserCopayLimit: '37200',
        User_x0020_Copay_x0020_Limit: '37200',
        CopayPaymentMethod: 'bank',
        Copay_x0020_Payment_x0020_Method: 'bank',
      });
    });
  });

  // ── PRE_MIGRATION: legacy-only writes ─────────────────────────────────
  describe('WRITE — PRE_MIGRATION stage', () => {
    it('writes legacy-only (does not write canonical column)', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Pre' }]);
      repo.__setBenefitCutoverStageForTest('PRE_MIGRATION');

      await repo.update(1, { GrantMunicipality: 'Kamakura' });

      const benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit).toHaveLength(1);
      expect(benefit[0].Grant_x0020_Municipality).toBe('Kamakura');
      expect(benefit[0].GrantMunicipality).toBeUndefined();
    });
  });

  // ── CUTOVER STEP 5: write-cutover (canonical only) ────────────────────
  describe('WRITE — WRITE_CUTOVER stage', () => {
    it('writes canonical-only (does not touch legacy column)', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Cutover' }]);
      repo.__setBenefitCutoverStageForTest('WRITE_CUTOVER');

      await repo.update(1, { GrantMunicipality: 'Chigasaki' });

      const benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit[0].GrantMunicipality).toBe('Chigasaki');
      expect(benefit[0].Grant_x0020_Municipality).toBeUndefined();
    });

    it('leaves previously written legacy values in place (does not clear them)', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Cutover2' }]);
      await provider.seed(BENEFIT_LIST, [
        {
          Id: 10,
          UserID: 'U-001',
          Grant_x0020_Municipality: 'stale-legacy',
        },
      ]);
      repo.__setBenefitCutoverStageForTest('WRITE_CUTOVER');

      await repo.update(1, { GrantMunicipality: 'Fujisawa' });

      const benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit[0].GrantMunicipality).toBe('Fujisawa');
      // Legacy column keeps its prior value — cleanup happens in Lot1B PR #G (drop-legacy).
      expect(benefit[0].Grant_x0020_Municipality).toBe('stale-legacy');
    });
  });

  // ── CUTOVER STEP 2: read fallback (new ?? old) ─────────────────────────
  describe('READ — fallback before READ_CUTOVER', () => {
    it('PRE_MIGRATION: legacy value is surfaced when canonical is missing', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Fallback' }]);
      await provider.seed(BENEFIT_LIST, [
        {
          Id: 10,
          UserID: 'U-001',
          Grant_x0020_Municipality: 'Legacy City',
          Meal_x0020_Addition: 'II',
        },
      ]);
      repo.__setBenefitCutoverStageForTest('PRE_MIGRATION');

      const user = await repo.getById(1, { selectMode: 'detail' });
      expect(user?.GrantMunicipality).toBe('Legacy City');
      expect(user?.MealAddition).toBe('II');
    });

    it('DUAL_WRITE: canonical takes precedence over legacy when both present', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Fallback2' }]);
      await provider.seed(BENEFIT_LIST, [
        {
          Id: 10,
          UserID: 'U-001',
          GrantMunicipality: 'Canonical City',
          Grant_x0020_Municipality: 'Legacy City',
        },
      ]);
      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');

      const user = await repo.getById(1, { selectMode: 'detail' });
      expect(user?.GrantMunicipality).toBe('Canonical City');
    });

    it('DUAL_WRITE: falls back to legacy when canonical is null', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Fallback3' }]);
      await provider.seed(BENEFIT_LIST, [
        {
          Id: 10,
          UserID: 'U-001',
          GrantMunicipality: null,
          Grant_x0020_Municipality: 'Legacy City',
        },
      ]);
      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');

      const user = await repo.getById(1, { selectMode: 'detail' });
      expect(user?.GrantMunicipality).toBe('Legacy City');
    });
  });

  // ── CUTOVER STEP 4: read cutover (canonical only) ─────────────────────
  describe('READ — canonical-only at READ_CUTOVER+', () => {
    it('READ_CUTOVER: returns null when only legacy value is present', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'ReadCutover' }]);
      await provider.seed(BENEFIT_LIST, [
        {
          Id: 10,
          UserID: 'U-001',
          Grant_x0020_Municipality: 'Legacy City',
        },
      ]);
      repo.__setBenefitCutoverStageForTest('READ_CUTOVER');

      const user = await repo.getById(1, { selectMode: 'detail' });
      expect(user?.GrantMunicipality).toBeNull();
    });

    it('READ_CUTOVER: returns canonical value when present', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'ReadCutover2' }]);
      await provider.seed(BENEFIT_LIST, [
        {
          Id: 10,
          UserID: 'U-001',
          GrantMunicipality: 'New City',
          Grant_x0020_Municipality: 'old-stale',
        },
      ]);
      repo.__setBenefitCutoverStageForTest('READ_CUTOVER');

      const user = await repo.getById(1, { selectMode: 'detail' });
      expect(user?.GrantMunicipality).toBe('New City');
    });

    it('WRITE_CUTOVER: still canonical-only on read', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'WriteCutover' }]);
      await provider.seed(BENEFIT_LIST, [
        {
          Id: 10,
          UserID: 'U-001',
          Grant_x0020_Municipality: 'Legacy-only',
        },
      ]);
      repo.__setBenefitCutoverStageForTest('WRITE_CUTOVER');

      const user = await repo.getById(1, { selectMode: 'detail' });
      expect(user?.GrantMunicipality).toBeNull();
    });
  });

  // ── ROLLBACK: stage を下げた際、write が legacy 側に戻ることを確認 ────
  describe('ROLLBACK — stage demotion restores legacy-compatible writes', () => {
    it('DUAL_WRITE → PRE_MIGRATION: subsequent writes target legacy only', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Rollback' }]);

      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');
      await repo.update(1, { GrantMunicipality: 'Phase1' });

      let benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit[0].GrantMunicipality).toBe('Phase1');
      expect(benefit[0].Grant_x0020_Municipality).toBe('Phase1');

      // Rollback: stage を PRE_MIGRATION へ戻す
      repo.__setBenefitCutoverStageForTest('PRE_MIGRATION');
      await repo.update(1, { GrantMunicipality: 'Phase2' });

      benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      // legacy は新しい値へ更新される
      expect(benefit[0].Grant_x0020_Municipality).toBe('Phase2');
      // canonical は触られないため前回の値のまま残る（SP 上の残置は意図的）
      expect(benefit[0].GrantMunicipality).toBe('Phase1');
    });

    it('WRITE_CUTOVER → DUAL_WRITE: subsequent writes resume dual-write', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Rollback2' }]);

      repo.__setBenefitCutoverStageForTest('WRITE_CUTOVER');
      await repo.update(1, { GrantMunicipality: 'CanonicalOnly' });

      let benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit[0].GrantMunicipality).toBe('CanonicalOnly');
      expect(benefit[0].Grant_x0020_Municipality).toBeUndefined();

      // Rollback to DUAL_WRITE
      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');
      await repo.update(1, { GrantMunicipality: 'DualAgain' });

      benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit[0].GrantMunicipality).toBe('DualAgain');
      expect(benefit[0].Grant_x0020_Municipality).toBe('DualAgain');
    });
  });

  // ── Non-migrating benefit columns must NOT be touched by the overlay ──
  describe('SCOPE — overlay only touches the 6 migrating columns', () => {
    it('RecipientCertExpiry continues to flow through the standard path', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Scoped' }]);
      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');

      await repo.update(1, {
        RecipientCertExpiry: '2027-03-31',
        GrantMunicipality: 'Yokohama',
      });

      const benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit[0].RecipientCertExpiry).toBe('2027-03-31');
      expect(benefit[0].GrantMunicipality).toBe('Yokohama');
      expect(benefit[0].Grant_x0020_Municipality).toBe('Yokohama');
    });

    it('update without any migrating columns does not emit any legacy keys', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'NoMigrating' }]);
      repo.__setBenefitCutoverStageForTest('DUAL_WRITE');

      await repo.update(1, { RecipientCertExpiry: '2027-03-31' });

      const benefit = await provider.listItems<Record<string, unknown>>(BENEFIT_LIST);
      expect(benefit[0].RecipientCertExpiry).toBe('2027-03-31');
      for (const legacyKey of [
        'Grant_x0020_Municipality',
        'Grant_x0020_Period_x0020_Start',
        'Grant_x0020_Period_x0020_End',
        'Meal_x0020_Addition',
        'User_x0020_Copay_x0020_Limit',
        'Copay_x0020_Payment_x0020_Method',
      ]) {
        expect(benefit[0][legacyKey]).toBeUndefined();
      }
    });
  });
});
