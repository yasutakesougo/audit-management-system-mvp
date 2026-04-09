import { describe, it, expect } from 'vitest';
import { resolveIbdGuardStatus } from '../useIbdPageGuard';

const IBD_USER    = { UserID: 'U-001', Id: 1, IsHighIntensitySupportTarget: true };
const NORMAL_USER = { UserID: 'U-002', Id: 2, IsHighIntensitySupportTarget: false };
const NULL_FLAG   = { UserID: 'U-003', Id: 3, IsHighIntensitySupportTarget: null };

const USERS = [IBD_USER, NORMAL_USER, NULL_FLAG];

describe('resolveIbdGuardStatus', () => {
  // ── userId 未指定 ────────────────────────────────────────────
  it('userIdなし → allowed（ウィザードStep1待ち）', () => {
    expect(resolveIbdGuardStatus(undefined, USERS, true)).toBe('allowed');
  });

  // ── ロード中 ──────────────────────────────────────────────────
  it('users未ロード → loading', () => {
    expect(resolveIbdGuardStatus('U-001', [], false)).toBe('loading');
  });

  it('usersReady=false → loading', () => {
    expect(resolveIbdGuardStatus('U-001', USERS, false)).toBe('loading');
  });

  // ── IBD対象者 ─────────────────────────────────────────────────
  it('IBD対象者（UserID一致）→ allowed', () => {
    expect(resolveIbdGuardStatus('U-001', USERS, true)).toBe('allowed');
  });

  it('IBD対象者（Id文字列一致）→ allowed', () => {
    expect(resolveIbdGuardStatus('1', USERS, true)).toBe('allowed');
  });

  // ── 非IBD対象者 ───────────────────────────────────────────────
  it('IsHighIntensitySupportTarget=false → redirecting', () => {
    expect(resolveIbdGuardStatus('U-002', USERS, true)).toBe('redirecting');
  });

  it('IsHighIntensitySupportTarget=null → redirecting', () => {
    expect(resolveIbdGuardStatus('U-003', USERS, true)).toBe('redirecting');
  });

  // ── 利用者不明 ────────────────────────────────────────────────
  it('存在しないuserId → redirecting', () => {
    expect(resolveIbdGuardStatus('U-999', USERS, true)).toBe('redirecting');
  });

  it('空文字列のuserId → allowed（未選択と同じ扱い）', () => {
    expect(resolveIbdGuardStatus('', USERS, true)).toBe('allowed');
  });
});
