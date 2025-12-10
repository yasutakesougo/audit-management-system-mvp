import { describe, expect, it } from 'vitest';
import { ensureConfig } from '../../src/lib/spClient';

describe('ensureConfig', () => {
  it('throws on placeholder values', () => {
    // E2E/Mock環境ではないことを確認するため、関連する環境変数を無効化
    const originalE2E = process.env.VITE_E2E;
    const originalPlaywright = process.env.PLAYWRIGHT_TEST;
    const originalMsalMock = process.env.VITE_E2E_MSAL_MOCK;

    process.env.VITE_E2E = '0';
    delete process.env.PLAYWRIGHT_TEST;
    process.env.VITE_E2E_MSAL_MOCK = '0';

    try {
      expect(() => ensureConfig({ VITE_SP_RESOURCE: 'https://contoso.sharepoint.com', VITE_SP_SITE_RELATIVE: '__FILL_ME__' })).toThrow(/接続設定が未完了/);
      expect(() => ensureConfig({ VITE_SP_RESOURCE: '<yourtenant>', VITE_SP_SITE_RELATIVE: '/sites/Audit' })).toThrow(/接続設定が未完了/);
    } finally {
      // 元の値を復元
      if (originalE2E !== undefined) {
        process.env.VITE_E2E = originalE2E;
      } else {
        delete process.env.VITE_E2E;
      }
      if (originalPlaywright !== undefined) {
        process.env.PLAYWRIGHT_TEST = originalPlaywright;
      }
      if (originalMsalMock !== undefined) {
        process.env.VITE_E2E_MSAL_MOCK = originalMsalMock;
      } else {
        delete process.env.VITE_E2E_MSAL_MOCK;
      }
    }
  });

  it('throws on invalid resource domain', () => {
    // E2E/Mock環境ではないことを確認するため、関連する環境変数を無効化
    const originalE2E = process.env.VITE_E2E;
    const originalPlaywright = process.env.PLAYWRIGHT_TEST;
    const originalMsalMock = process.env.VITE_E2E_MSAL_MOCK;

    process.env.VITE_E2E = '0';
    delete process.env.PLAYWRIGHT_TEST;
    process.env.VITE_E2E_MSAL_MOCK = '0';

    try {
      expect(() => ensureConfig({ VITE_SP_RESOURCE: 'https://example.com', VITE_SP_SITE_RELATIVE: '/sites/Audit' })).toThrow(/形式が不正/);
    } finally {
      // 元の値を復元
      if (originalE2E !== undefined) {
        process.env.VITE_E2E = originalE2E;
      } else {
        delete process.env.VITE_E2E;
      }
      if (originalPlaywright !== undefined) {
        process.env.PLAYWRIGHT_TEST = originalPlaywright;
      }
      if (originalMsalMock !== undefined) {
        process.env.VITE_E2E_MSAL_MOCK = originalMsalMock;
      } else {
        delete process.env.VITE_E2E_MSAL_MOCK;
      }
    }
  });

  it('normalizes trailing/leading slashes and builds baseUrl', () => {
    const cfg = ensureConfig({ VITE_SP_RESOURCE: 'https://foo.sharepoint.com/', VITE_SP_SITE_RELATIVE: 'sites/TeamX/' });
    expect(cfg.resource).toBe('https://foo.sharepoint.com');
    expect(cfg.siteRel).toBe('/sites/TeamX');
    expect(cfg.baseUrl).toBe('https://foo.sharepoint.com/sites/TeamX/_api/web');
  });
});
