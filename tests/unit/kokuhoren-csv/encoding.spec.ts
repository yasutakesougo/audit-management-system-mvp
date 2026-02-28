import { describe, expect, it } from 'vitest';

import { encodeToSjis } from '@/features/kokuhoren-csv/encoding';

describe('encodeToSjis', () => {
  it('ASCII文字列 → そのまま（Shift_JIS = ASCII互換）', () => {
    const result = encodeToSjis('abc123');
    expect(result).toBeInstanceOf(Uint8Array);
    // ASCII部分はバイト値が一致
    expect(Array.from(result)).toEqual([0x61, 0x62, 0x63, 0x31, 0x32, 0x33]);
  });

  it('日本語「あ」→ SJIS 0x82 0xA0', () => {
    const result = encodeToSjis('あ');
    expect(result.length).toBe(2);
    expect(result[0]).toBe(0x82);
    expect(result[1]).toBe(0xa0);
  });

  it('CSV行（数値+引用符付き日本語）→ SJIS変換可能', () => {
    const csv = '71,"テスト太郎",15\r\n';
    const result = encodeToSjis(csv);
    expect(result).toBeInstanceOf(Uint8Array);
    // 先頭は "7" = 0x37, "1" = 0x31
    expect(result[0]).toBe(0x37);
    expect(result[1]).toBe(0x31);
    // 末尾は \r\n = 0x0D 0x0A
    expect(result[result.length - 2]).toBe(0x0d);
    expect(result[result.length - 1]).toBe(0x0a);
  });

  it('空文字列 → 空Uint8Array', () => {
    const result = encodeToSjis('');
    expect(result.length).toBe(0);
  });

  it('カンマとダブルクォートが保持される', () => {
    const csv = ',"abc",,';
    const result = encodeToSjis(csv);
    // , = 0x2C, " = 0x22, a = 0x61
    expect(result[0]).toBe(0x2c);
    expect(result[1]).toBe(0x22);
    expect(result[2]).toBe(0x61);
  });

  it('半角カナも変換可能', () => {
    const result = encodeToSjis('ｱ');
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0xb1); // SJIS半角カナ「ｱ」
  });
});
