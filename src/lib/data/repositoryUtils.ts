/**
 * Repository共通のデータ変換ユーティリティ
 * 
 * 役割:
 * 1. Clearable Contract: undefined (不変) / null or empty (クリア) のセマンティクスを統一
 * 2. Case-Insensitive Mapping: DTO(Pascal) と Registry(camel) のキーのズレを吸収
 * 3. Payload Integrity: 無効なフィールドや空の更新（No-op）を防止
 */

/**
 * 更新値の正規化
 * - undefined: プロパティ自体を削除（更新対象外）
 * - null / "" / whitespace: null に統一（明示的クリア）
 * - その他: そのまま返す
 */
export function normalizeClearableValue<T>(
  value: T | null | undefined,
): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  return value;
}

/**
 * オブジェクトから大文字小文字を区別せずにプロパティ値を取得
 * DTO (PascalCase) と内部定義 (camelCase) のマッピングに使用
 */
export function getCaseInsensitiveValue(
  source: Record<string, unknown>,
  logicalKey: string,
): unknown {
  const sourceKeys = Object.keys(source);
  const actualKey = sourceKeys.find(
    key => key.toLowerCase() === logicalKey.toLowerCase(),
  );

  return actualKey ? source[actualKey] : undefined;
}

/**
 * 入力 DTO と マッピング定義に基づき、物理リクエスト用ペイロードを構築
 */
export function buildMappedPayload(args: {
  input: Record<string, unknown>;
  mapping: Record<string, string | undefined>;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [logicalKey, physicalName] of Object.entries(args.mapping)) {
    if (!physicalName) continue;

    // input (DTO) から論理キーに対応する値を大文字小文字不問で探す
    const rawValue = getCaseInsensitiveValue(args.input, logicalKey);
    const normalized = normalizeClearableValue(rawValue);

    // 明示的に値が指定されている（undefined でない）場合のみ物理フィールドにセット
    if (normalized !== undefined) {
      payload[physicalName] = normalized;
    }
  }

  return payload;
}

/**
 * ペイロードが空（更新すべき内容がない）かどうかを判定
 */
export function isNoopPayload(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).length === 0;
}
