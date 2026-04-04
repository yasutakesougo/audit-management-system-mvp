/**
 * GenericSaver.ts — SharePoint Fail-Open 保存の共通基盤
 *
 * 3モジュール (Daily / ActivityDiary / MonitoringMeeting) で共通だった
 * 「動的ペイロード構築 + Fail-Open 保存」パターンを1箇所に統合。
 *
 * 責務:
 * 1. resolved 名に基づく動的ペイロード構築 (buildFailOpenPayload)
 * 2. 未マップフィールドのスキップ + WARN テレメトリ (Fail-Open)
 * 3. SP REST API への create / update 送信 (spCreate / spUpdate)
 *
 * 各ドメインの Saver はこのモジュールの関数を使い、
 * ドメイン固有の payload builder / transform だけ自前で持つ。
 *
 * @see GenericSchemaResolver.ts — schema resolution
 * @see schemaUtils.ts — low-level SP helpers
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import { auditLog } from '@/lib/debugLogger';

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * フィールドマッピング定義。
 * [0]: 書き込む値
 * [1]: candidates のキー名（resolved 名を引くためのキー）
 */
export type FieldMapping = [value: unknown, candidateKey: string];

/**
 * buildFailOpenPayload の結果。
 */
export interface FailOpenPayloadResult {
  /** SP に送信可能な payload */
  payload: Record<string, unknown>;
  /** resolved できずスキップされたフィールドキー */
  skippedFields: string[];
}

// ── Payload Builder ─────────────────────────────────────────────────────────

/**
 * resolved フィールド名に基づき、SP 書き込み用ペイロードを動的に構築する。
 *
 * - resolved されたフィールドのみ payload に含める (Fail-Open)
 * - 未 resolved フィールドは WARN テレメトリを出力してスキップ
 * - Title フィールドは SP で通常必須のため、fallback を自動適用
 *
 * @param resolved - SchemaResolver から取得した { candidateKey → actualSpName } マップ
 * @param mappings - ドメイン側が定義した [value, candidateKey] の配列
 * @param telemetryLabel - ログ出力用のリスト識別子 (例: 'Daily', 'ActivityDiary')
 * @param titleFallback - Title カラムに設定するフォールバック値 (optional)
 */
export function buildFailOpenPayload(
  resolved: Record<string, string | undefined>,
  mappings: FieldMapping[],
  telemetryLabel: string,
  titleFallback?: string,
): FailOpenPayloadResult {
  const payload: Record<string, unknown> = {};
  const skippedFields: string[] = [];

  for (const [value, candidateKey] of mappings) {
    const resolvedName = resolved[candidateKey];
    if (resolvedName) {
      payload[resolvedName] = value;
    } else {
      skippedFields.push(candidateKey);
      auditLog.warn('sp', 'sp:field_missing_optional', {
        list: telemetryLabel,
        field: candidateKey,
      });
    }
  }

  // Title は SP の標準必須カラム。payload に含まれていなければ fallback を適用
  if (!payload['Title'] && titleFallback) {
    payload['Title'] = titleFallback;
  }

  return { payload, skippedFields };
}

// ── SP REST Helpers ─────────────────────────────────────────────────────────

/**
 * SharePoint リストに新規アイテムを作成する。
 * @returns 作成されたアイテムの SP ID
 */
export async function spCreate(
  spFetch: SpFetchFn,
  listPath: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const res = await spFetch(`${listPath}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=nometadata',
      'Accept': 'application/json;odata=nometadata',
    },
    body: JSON.stringify(payload),
  });
  const created = await res.json();
  return created.d?.Id || created.Id;
}

/**
 * SharePoint リストの既存アイテムを MERGE 更新する。
 */
export async function spUpdate(
  spFetch: SpFetchFn,
  listPath: string,
  spId: number,
  payload: Record<string, unknown>,
  etag?: string,
): Promise<void> {
  await spFetch(`${listPath}/items(${spId})`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=nometadata',
      'Accept': 'application/json;odata=nometadata',
      'IF-MATCH': etag ?? '*',
      'X-HTTP-Method': 'MERGE',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * SharePoint リストのアイテムを削除する。
 */
export async function spDelete(
  spFetch: SpFetchFn,
  listPath: string,
  spId: number,
): Promise<void> {
  await spFetch(`${listPath}/items(${spId})`, {
    method: 'POST',
    headers: {
      'X-HTTP-Method': 'DELETE',
      'IF-MATCH': '*',
    },
  });
}
