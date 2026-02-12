/**
 * SharePoint Procedure Template Repository
 * 
 * SupportTemplates リストから支援手順テンプレートを取得するリポジトリ
 * 
 * 重要: このリストの内部名には "0" サフィックスが付与されています
 * - userCode → UserCode0
 * - rowNo → RowNo0
 * - timeSlot → TimeSlot0
 * - activity → Activity0
 * - personManual → PersonManual0
 * - supporterManual → SupporterManual0
 * 
 * ✅ 正しい使用例:
 * const orderby = FIELD_MAP_SUPPORT_TEMPLATES.rowNo; // 'RowNo0'
 * const filter = `${FIELD_MAP_SUPPORT_TEMPLATES.userCode} eq '${userId}'`; // 'UserCode0 eq ...'
 * 
 * ❌ 間違った使用例（500エラーになる）:
 * const orderby = 'rowNo'; // SharePoint に 'rowNo' 列は存在しない
 * const filter = `userCode eq '${userId}'`; // SharePoint に 'userCode' 列は存在しない
 */

import { createSpClient, ensureConfig } from '@/lib/spClient';
import {
  SUPPORT_TEMPLATES_LIST_TITLE,
  FIELD_MAP_SUPPORT_TEMPLATES,
  SUPPORT_TEMPLATES_SELECT_FIELDS,
} from '@/sharepoint/fields';

export type SupportTemplateItem = {
  Id?: number;
  Title: string;
  UserCode: string;
  RowNo: number;
  TimeSlot: string;
  Activity: string;
  PersonManual?: string | null;
  SupporterManual?: string | null;
  Created?: string;
  Modified?: string;
};

type SharePointTemplateRow = Record<string, unknown> & { Id?: number };

/**
 * SharePoint レスポンスを SupportTemplateItem に変換
 */
const toSupportTemplate = (row: SharePointTemplateRow): SupportTemplateItem | null => {
  const fields = FIELD_MAP_SUPPORT_TEMPLATES;
  
  const id = row[fields.id];
  const title = row[fields.title];
  const userCode = row[fields.userCode];
  const rowNo = row[fields.rowNo];
  const timeSlot = row[fields.timeSlot];
  const activity = row[fields.activity];
  const personManual = row[fields.personManual];
  const supporterManual = row[fields.supporterManual];
  const created = row[fields.created];
  const modified = row[fields.modified];

  if (typeof userCode !== 'string' || typeof title !== 'string') return null;

  return {
    Id: typeof id === 'number' ? id : undefined,
    Title: title,
    UserCode: userCode,
    RowNo: typeof rowNo === 'number' ? rowNo : 0,
    TimeSlot: typeof timeSlot === 'string' ? timeSlot : '',
    Activity: typeof activity === 'string' ? activity : '',
    PersonManual: typeof personManual === 'string' ? personManual : null,
    SupporterManual: typeof supporterManual === 'string' ? supporterManual : null,
    Created: typeof created === 'string' ? created : undefined,
    Modified: typeof modified === 'string' ? modified : undefined,
  };
};

/**
 * 指定ユーザーの支援手順テンプレートを取得
 * 
 * @param client SharePoint client
 * @param userCode ユーザーコード (e.g., 'I001')
 * @param listTitle リスト名（デフォルト: SupportTemplates）
 * @returns SupportTemplateItem[]
 * 
 * @example
 * const templates = await getTemplatesByUser(client, 'I001');
 * // SELECT UserCode0, RowNo0, TimeSlot0, Activity0, PersonManual0, SupporterManual0
 * // WHERE UserCode0 eq 'I001'
 * // ORDER BY RowNo0 asc
 */
export async function getTemplatesByUser(
  client: ReturnType<typeof createSpClient>,
  userCode: string,
  listTitle: string = SUPPORT_TEMPLATES_LIST_TITLE
): Promise<SupportTemplateItem[]> {
  const fields = FIELD_MAP_SUPPORT_TEMPLATES;
  
  // ✅ 正しい使い方: FIELD_MAP経由で内部名を取得
  const select = [...SUPPORT_TEMPLATES_SELECT_FIELDS] as unknown as string[];
  const filter = `${fields.userCode} eq '${escapeSingleQuotes(userCode)}'`; // UserCode0 eq 'I001'
  const orderby = fields.rowNo; // RowNo0

  const rows = await client.getListItemsByTitle<SharePointTemplateRow>(
    listTitle,
    select,
    filter,
    orderby
  );

  return (rows ?? [])
    .map(toSupportTemplate)
    .filter((t): t is SupportTemplateItem => t !== null);
}

/**
 * すべての支援手順テンプレートを取得
 * 
 * @param client SharePoint client
 * @param listTitle リスト名（デフォルト: SupportTemplates）
 * @returns SupportTemplateItem[]
 */
export async function getAllTemplates(
  client: ReturnType<typeof createSpClient>,
  listTitle: string = SUPPORT_TEMPLATES_LIST_TITLE
): Promise<SupportTemplateItem[]> {
  const fields = FIELD_MAP_SUPPORT_TEMPLATES;
  
  const select = [...SUPPORT_TEMPLATES_SELECT_FIELDS] as unknown as string[];
  const orderby = `${fields.userCode} asc,${fields.rowNo} asc`; // UserCode0 asc, RowNo0 asc

  const rows = await client.getListItemsByTitle<SharePointTemplateRow>(
    listTitle,
    select,
    undefined, // no filter
    orderby
  );

  return (rows ?? [])
    .map(toSupportTemplate)
    .filter((t): t is SupportTemplateItem => t !== null);
}

/**
 * シングルクォートをエスケープ（OData クエリ用）
 */
function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * デフォルトクライアントでのヘルパー（認証付き）
 */
export function createSupportTemplateRepository(
  acquireToken: () => Promise<string | null>
) {
  const client = createSpClient(acquireToken, ensureConfig().baseUrl);

  return {
    getTemplatesByUser: (userCode: string, listTitle?: string) =>
      getTemplatesByUser(client, userCode, listTitle),
    getAllTemplates: (listTitle?: string) =>
      getAllTemplates(client, listTitle),
  };
}
