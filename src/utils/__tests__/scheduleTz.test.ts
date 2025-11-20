/**
 * スケジュールタイムゾーンユーティリティの核心機能テスト
 * 'env → alias → Intl → date-fns-tz → fallback' レイヤーの基本動作を検証
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 環境変数mockを簡潔に
vi.mock('@/lib/env', () => ({
  getAppConfig: vi.fn(() => ({ schedulesTz: undefined })),
}));

import {
    assertValidTz,
    DEFAULT_TZ,
    DEFAULT_TZ_CANDIDATES,
    isValidTimeZone
} from '../scheduleTz';

const originalIntl = global.Intl;

describe('scheduleTz Core Functions', () => {
  afterEach(() => {
    global.Intl = originalIntl;
  });

  describe('isValidTimeZone', () => {
    it('有効なIANA ID を正しく認識', () => {
      expect(isValidTimeZone('Asia/Tokyo')).toBe(true);
      expect(isValidTimeZone('America/New_York')).toBe(true);
      expect(isValidTimeZone('UTC')).toBe(true);
    });

    it('エイリアスを正しく処理', () => {
      expect(isValidTimeZone('jst')).toBe(true);
      expect(isValidTimeZone('jp')).toBe(true);
      expect(isValidTimeZone('japan')).toBe(true);
      expect(isValidTimeZone('utc')).toBe(true);
      expect(isValidTimeZone('est')).toBe(true);
    });

    it('無効なタイムゾーン ID を拒否', () => {
      expect(isValidTimeZone('Not/AZone')).toBe(false);
      expect(isValidTimeZone('Invalid_TZ')).toBe(false);
      expect(isValidTimeZone('')).toBe(false);
      expect(isValidTimeZone('   ')).toBe(false);
      expect(isValidTimeZone(undefined)).toBe(false);
    });

    it('大文字小文字・空白を適切に処理', () => {
      expect(isValidTimeZone('JST')).toBe(true);
      expect(isValidTimeZone('Jst')).toBe(true);
      expect(isValidTimeZone(' jst ')).toBe(true);
    });
  });

  describe('assertValidTz', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('有効なタイムゾーンをそのまま返す', () => {
      expect(assertValidTz('Asia/Tokyo')).toBe('Asia/Tokyo');
      expect(assertValidTz('America/New_York')).toBe('America/New_York');
      expect(assertValidTz('jst')).toBe('Asia/Tokyo');
    });

    it('無効なタイムゾーンで候補チェーンを使用', () => {
      const result = assertValidTz('Invalid/TZ');
      // DEFAULT_TZ_CANDIDATESまたはDEFAULT_TZのいずれかが返される
      const validResults = [...DEFAULT_TZ_CANDIDATES, DEFAULT_TZ];
      expect(validResults.includes(result)).toBe(true);
    });

    it('空候補リストでカスタムフォールバック', () => {
      expect(assertValidTz('Invalid/TZ', {
        candidates: [],
        fallback: 'UTC'
      })).toBe('UTC');
    });

    it('全て無効な場合のフォールバック（Asia/Tokyo → UTC）', () => {
      // 実装では candidates → fallback → DEFAULT_TZ → UTC の順でフォールバック
      const result = assertValidTz('Invalid/TZ', {
        candidates: ['Invalid/One', 'Invalid/Two'],
        fallback: 'Invalid/Fallback'
      });
      // DEFAULT_TZ（Asia/Tokyo）が返される（UTCの前にチェックされる）
      expect(result).toBe(DEFAULT_TZ);
    });

    it('候補リストの重複除去', () => {
      const result = assertValidTz('Invalid/TZ', {
        candidates: ['Asia/Tokyo', 'Asia/Tokyo', 'UTC', 'UTC']
      });
      expect(result).toBe('Asia/Tokyo');
    });
  });

  describe('DEFAULT_TZ_CANDIDATES 統合', () => {
    it('すべての候補が有効なタイムゾーン', () => {
      DEFAULT_TZ_CANDIDATES.forEach(tz => {
        expect(isValidTimeZone(tz)).toBe(true);
      });
    });

    it('無効入力時にDEFAULT_TZ_CANDIDATESが自動使用', () => {
      const result = assertValidTz('Invalid/TZ');
      const validOptions = [...DEFAULT_TZ_CANDIDATES, DEFAULT_TZ, 'UTC'];
      expect(validOptions.includes(result)).toBe(true);
    });
  });

  describe('Intl サポートなし環境での date-fns-tz フォールバック', () => {
    beforeEach(() => {
      (global as { Intl: typeof Intl | undefined }).Intl = undefined;
    });

    it('Intl無効環境でのフォールバック動作', () => {
      // Intl無効環境では date-fns-tz による検証のみ
      // 環境によっては多くのタイムゾーンが無効になる可能性
      const utcResult = isValidTimeZone('UTC');
      const asiaTokyoResult = isValidTimeZone('Asia/Tokyo');

      // 結果は boolean である
      expect(typeof utcResult).toBe('boolean');
      expect(typeof asiaTokyoResult).toBe('boolean');

      // assertValidTz は必ず何らかの有効なTZを返す
      const fallbackResult = assertValidTz('Invalid/TZ');
      expect(typeof fallbackResult).toBe('string');
      expect(fallbackResult.length).toBeGreaterThan(0);
    });

    it('date-fns-tz経由で無効なタイムゾーンを拒否', () => {
      expect(isValidTimeZone('Not/Valid')).toBe(false);
    });
  });

  describe('エイリアス処理の詳細', () => {
    it('新しく追加されたエイリアスの動作確認', () => {
      expect(assertValidTz('japan')).toBe('Asia/Tokyo');
      expect(assertValidTz('est')).toBe('America/New_York');
      expect(assertValidTz('pst')).toBe('America/Los_Angeles');
      expect(assertValidTz('gmt')).toBe('UTC');
    });

    it('エイリアス + 大文字小文字混合', () => {
      expect(assertValidTz('JAPAN')).toBe('Asia/Tokyo');
      expect(assertValidTz('Est')).toBe('America/New_York');
      expect(assertValidTz(' GMT ')).toBe('UTC');
    });
  });
});