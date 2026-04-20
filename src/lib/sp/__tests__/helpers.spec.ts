
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed } from '../helpers';

describe('resolveInternalNamesDetailed - Hardened Drift Resolution', () => {
  const candidates = {
    recipientCertNumber: [
      'RecipientCertNumber',
      'Recipient Cert Number',
      'RecipientCertNumber0',
      'Recipient_x0020_Cert_x0020_Numbe'
    ],
    fullName: ['FullName', 'Full Name'],
    userId: ['UserID', 'User_x0020_ID', 'UserCode']
  };

  it('SHOULD find multi-digit zombies (Pass: Strategy A Regex)', () => {
    const available = new Set(['RecipientCertNumber99', 'Title']);
    const { resolved } = resolveInternalNamesDetailed(available, candidates);
    expect(resolved.recipientCertNumber).toBe('RecipientCertNumber99');
  });

  it('SHOULD find truncated columns with encoded spaces (Pass: Strategy D)', () => {
    // "Recipient Cert Number" (encoded) -> "Recipient_x0020_Cert_x0020_Number" (length 33)
    // SharePoint truncates this to 32 chars: "Recipient_x0020_Cert_x0020_Numbe"
    const available = new Set(['Recipient_x0020_Cert_x0020_Numbe']);
    const { resolved } = resolveInternalNamesDetailed(available, candidates);
    expect(resolved.recipientCertNumber).toBe('Recipient_x0020_Cert_x0020_Numbe');
  });

  it('SHOULD find encoded + suffix combined drift (Pass: Strategy A with encoding)', () => {
    const available = new Set(['User_x0020_ID95']);
    const { resolved } = resolveInternalNamesDetailed(available, candidates);
    expect(resolved.userId).toBe('User_x0020_ID95');
  });

  it('SHOULD find extremely drifted names via normalized comparison (Pass: Strategy C)', () => {
    // Legacy mapping or extreme drift: "RecipientCertNo"
    const available = new Set(['RecipientCertNo']);
    const extCandidates = { ...candidates, recipientCertNumber: [...candidates.recipientCertNumber, 'RecipientCertNo'] };
    const { resolved } = resolveInternalNamesDetailed(available, extCandidates);
    expect(resolved.recipientCertNumber).toBe('RecipientCertNo');
  });

  describe('False Positive Prevention', () => {
    it('SHOULD NOT match FullName with FullNameKana', () => {
      const available = new Set(['FullName', 'FullNameKana']);
      const { resolved } = resolveInternalNamesDetailed(available, candidates);
      // FullName should find FullName exactly, NOT greedily take FullNameKana if FullName is missing
      expect(resolved.fullName).toBe('FullName');
    });

    it('SHOULD NOT match unrelated fields even if they share a prefix', () => {
      const available = new Set(['StaffCode', 'StaffRole']);
      const testCandidates = { staff: ['Staff'] };
      const { resolved } = resolveInternalNamesDetailed(available, testCandidates);
      // "Staff" should not match "StaffCode" just because it's a prefix
      // because Strategy C requires length >= 28 for prefix matching
      expect(resolved.staff).toBeUndefined();
    });

    it('SHOULD NOT match short truncated names blindly', () => {
      const available = new Set(['Reci']);
      const { resolved } = resolveInternalNamesDetailed(available, candidates);
      expect(resolved.recipientCertNumber).toBeUndefined();
    });
  });
});
