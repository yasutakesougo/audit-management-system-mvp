import { 
  normalizeClearableValue, 
  buildMappedPayload, 
  isNoopPayload 
} from './repositoryUtils';
import type { NormalizedPayload, PhysicalWritePayload } from './contract';

/**
 * Repository 基底クラス
 * 
 * 役割:
 * - 共通ユーティリティへのアクセスの提供
 * - データ規約（Contract）の遵守を型レベルで支援
 */
export abstract class BaseRepository {
  /** 
   * クリア可能フィールドの正規化
   * undefined (不変) / null (クリア) / "" (クリア)
   */
  protected normalizeClearableValue = normalizeClearableValue;

  /**
   * マッピング定義に基づくペイロード構築。
   * 入力として NormalizedPayload<T> を期待し、内部で規約を適用する。
   */
  protected buildMappedPayload<T extends Record<string, unknown>>(args: {
    input: NormalizedPayload<T>;
    mapping: Record<string, string | undefined>;
  }): PhysicalWritePayload {
    return buildMappedPayload({
      input: args.input as Record<string, unknown>,
      mapping: args.mapping as Record<string, string>
    });
  }

  /**
   * 更新内容がないかどうかの判定
   */
  protected isNoopPayload(payload: PhysicalWritePayload): boolean {
    return isNoopPayload(payload);
  }

  /**
   * 書き込み可能なペイロードであることを保証（No-op チェック）
   */
  protected assertWritablePayload(payload: PhysicalWritePayload): boolean {
    return !this.isNoopPayload(payload);
  }
}
