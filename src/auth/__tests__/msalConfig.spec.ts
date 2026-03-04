import { describe, expect, it } from 'vitest';
import {
    GRAPH_RESOURCE,
    GRAPH_SCOPES,
    LOGIN_SCOPES,
    msalConfig,
    SP_RESOURCE,
} from '../msalConfig';

describe('msalConfig', () => {
  describe('exported constants', () => {
    it('GRAPH_RESOURCE is Microsoft Graph URL', () => {
      expect(GRAPH_RESOURCE).toBe('https://graph.microsoft.com');
    });

    it('GRAPH_SCOPES includes User.Read and GroupMember.Read.All', () => {
      expect(GRAPH_SCOPES).toContain('User.Read');
      expect(GRAPH_SCOPES).toContain('GroupMember.Read.All');
    });

    it('LOGIN_SCOPES includes identity scopes and graph scopes', () => {
      expect(LOGIN_SCOPES).toContain('openid');
      expect(LOGIN_SCOPES).toContain('profile');
      expect(LOGIN_SCOPES).toContain('offline_access');
      // LOGIN_SCOPES spreads GRAPH_SCOPES
      for (const scope of GRAPH_SCOPES) {
        expect(LOGIN_SCOPES).toContain(scope);
      }
    });

    it('SP_RESOURCE is a string (may be empty in test env)', () => {
      expect(typeof SP_RESOURCE).toBe('string');
    });
  });

  describe('msalConfig structure', () => {
    it('has auth.clientId (test placeholder in CI)', () => {
      expect(msalConfig.auth.clientId).toBeTruthy();
      expect(typeof msalConfig.auth.clientId).toBe('string');
    });

    it('has auth.authority with tenant', () => {
      expect(msalConfig.auth.authority).toMatch(/https:\/\/login\.microsoftonline\.com\//);
    });

    it('has auth.redirectUri', () => {
      expect(typeof msalConfig.auth.redirectUri).toBe('string');
      expect(msalConfig.auth.redirectUri.length).toBeGreaterThan(0);
    });

    it('has auth.postLogoutRedirectUri', () => {
      expect(typeof msalConfig.auth.postLogoutRedirectUri).toBe('string');
    });

    it('uses localStorage cacheLocation', () => {
      expect(msalConfig.cache.cacheLocation).toBe('localStorage');
    });

    it('enables storeAuthStateInCookie for Safari/iOS compat', () => {
      expect(msalConfig.cache.storeAuthStateInCookie).toBe(true);
    });
  });
});
