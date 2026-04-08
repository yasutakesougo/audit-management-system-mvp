import { normalizeId } from '@/lib/data/dataHelpers';
import type { BillingOrder } from '../types';

/**
 * 外部の未知の値を安全に文字列として解釈する
 * - string型ならそのまま
 * - null/undefinedなら空文字
 * - 数値等の場合はString()による文字列表現にフォールバック
 */
export const safeParseString = (v: unknown): string =>
  typeof v === 'string' ? v : String(v ?? '');

/**
 * 外部の未知の値を安全な数値として解釈する
 * - Number.isFinite でNaNやInfinityを弾く
 * - 無効な値やパースできない文字列("abc"など)は 0 へフォールバック
 * - 前後空白をもつ文字列表現(" 150 ")も標準のNumberキャストにより正しく数値になる
 * - 現状仕様として負数("-1")はそのまま許容し維持する
 */
export const safeParseNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * SharePointの生アイテム(辞書)をアプリケーション内部のBillingOrderモデルに安全に変換する
 * @param item SharePointの行データ（DTO）
 * @param mapping 解決された内部名のマッピング
 */
export function mapToBillingOrder(
  item: Record<string, unknown>,
  mapping: Record<string, string | undefined>
): BillingOrder {
  const F = mapping;
  return {
    id: normalizeId(item),
    orderDate: safeParseString(item[F.orderDate ?? 'Title'] ?? item['orderDate'] ?? ''),
    ordererCode: safeParseString(item[F.ordererCode ?? 'OrdererCode'] ?? item['ordererCode'] ?? ''),
    ordererName: safeParseString(item[F.ordererName ?? 'OrdererName'] ?? item['ordererName'] ?? ''),
    orderCount: safeParseNumber(item[F.orderCount ?? 'OrderCount'] ?? item['orderCount'] ?? 0),
    served: safeParseString(item[F.served ?? 'Served'] ?? item['served'] ?? ''),
    item: safeParseString(item[F.item ?? 'Item'] ?? item['item'] ?? ''),
    sugar: safeParseString(item[F.sugar ?? 'Sugar'] ?? item['sugar'] ?? ''),
    milk: safeParseString(item[F.milk ?? 'Milk'] ?? item['milk'] ?? ''),
    drinkPrice: safeParseNumber(item[F.drinkPrice ?? 'DrinkPrice'] ?? item['drinkPrice'] ?? 0),
  };
}
