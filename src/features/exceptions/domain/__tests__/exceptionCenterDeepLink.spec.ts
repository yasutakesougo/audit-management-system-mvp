import { describe, expect, it } from 'vitest';
import {
  buildExceptionCenterDeepLinkPath,
  parseExceptionCenterDeepLinkParams,
} from '../exceptionCenterDeepLink';

describe('exceptionCenterDeepLink', () => {
  it('build: category/userId/source を含む deep link を生成する', () => {
    const path = buildExceptionCenterDeepLinkPath({
      category: 'attention-user',
      userId: 'U-001',
      source: 'today',
    });
    expect(path).toBe('/admin/exception-center?category=attention-user&userId=U-001&source=today');
  });

  it('build: 空入力はベースパスを返す', () => {
    expect(buildExceptionCenterDeepLinkPath()).toBe('/admin/exception-center');
    expect(buildExceptionCenterDeepLinkPath({ category: 'all' })).toBe('/admin/exception-center');
  });

  it('parse: query から category と userId を復元する', () => {
    const params = new URLSearchParams('category=missing-record&userId=U-009&source=today');
    const result = parseExceptionCenterDeepLinkParams(params);
    expect(result.category).toBe('missing-record');
    expect(result.userId).toBe('U-009');
    expect(result.source).toBe('today');
  });

  it('parse: 不正 category は all にフォールバックする', () => {
    const params = new URLSearchParams('category=unknown&userId=');
    const result = parseExceptionCenterDeepLinkParams(params);
    expect(result.category).toBe('all');
    expect(result.userId).toBeNull();
  });
});
