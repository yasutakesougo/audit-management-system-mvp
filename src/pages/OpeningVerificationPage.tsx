/**
 * OpeningVerificationPage — A班 Day-2 開通確認コンソール
 *
 * Step1: checkAllLists()      → リスト存在確認
 * Step2: フィールド照合        → InternalName / FieldType / Required / Lookup 一致確認
 * Step3: SELECT検証           → FIELD_MAPから生成した$selectがテナントで通るか
 * Step4: CRUD テスト           → Read / Create / Update
 *
 * /admin/debug/opening-verification でアクセス
 */
import { WriteDisabledBanner } from '@/components/WriteDisabledBanner';
import { isWriteEnabled } from '@/env';
import { getAppConfig } from '@/lib/env';
import { ATTENDANCE_DAILY_SELECT_FIELDS, ATTENDANCE_USERS_SELECT_FIELDS, STAFF_ATTENDANCE_FIELDS, STAFF_ATTENDANCE_SELECT_FIELDS } from '@/sharepoint/fields/attendanceFields';
import { DAILY_ACTIVITY_SELECT_FIELDS, FIELD_MAP_DAILY_ACTIVITY } from '@/sharepoint/fields/dailyFields';
import { FIELD_MAP_HANDOFF, buildHandoffSelectFields } from '@/sharepoint/fields/handoffFields';
import { ORG_MASTER_SELECT_FIELDS } from '@/sharepoint/fields/orgMasterFields';
import { SCHEDULES_BASE_FIELDS } from '@/sharepoint/fields/scheduleFields';
import { SERVICE_PROVISION_SELECT_FIELDS } from '@/sharepoint/fields/serviceProvisionFields';
import { STAFF_MASTER_FIELD_MAP, STAFF_SELECT_FIELDS_CANONICAL } from '@/sharepoint/fields/staffFields';
import { USERS_MASTER_FIELD_MAP, USERS_SELECT_FIELDS_CORE } from '@/sharepoint/fields/userFields';
import { checkAllLists, type HealthCheckSummary, type ListCheckResult, type ListCheckStatus } from '@/sharepoint/spListHealthCheck';
import { SP_LIST_REGISTRY } from '@/sharepoint/spListRegistry';
import { useMsal } from '@azure/msal-react';
import { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldCheckResult {
  listKey: string;
  listName: string;
  fieldApp: string;
  fieldTenant: string;
  exists: boolean;
  typeMatch: boolean | null;
  tenantType: string | null;
  required: boolean;
  isLookup: boolean;
  status: 'ok' | 'missing' | 'type_mismatch' | 'unmapped_required' | 'lookup_warning';
  expectedJsType?: string;
}

interface CrudResult {
  entity: string;
  listName: string;
  read: 'ok' | 'fail' | 'skip' | 'pending';
  create: 'ok' | 'fail' | 'skip' | 'pending';
  update: 'ok' | 'fail' | 'skip' | 'pending';
  readError?: string;
  createError?: string;
  updateError?: string;
  readCount?: number;
  createdId?: number;
}

// ---------------------------------------------------------------------------
// Day-0 必須リスト キー一覧
// ---------------------------------------------------------------------------
const DAY0_REQUIRED_KEYS = [
  'users_master', 'staff_master', 'org_master',
  'support_record_daily', 'daily_activity_records', 'service_provision_records', 'activity_diary',
  'daily_attendance', 'attendance_users', 'attendance_daily', 'staff_attendance',
  'handoff',
];

// ---------------------------------------------------------------------------
// フィールドマップ定義（リストキー → フィールドマップ）
// ---------------------------------------------------------------------------
const FIELD_MAPS: Record<string, Record<string, string>> = {
  users_master: USERS_MASTER_FIELD_MAP as unknown as Record<string, string>,
  staff_master: STAFF_MASTER_FIELD_MAP as unknown as Record<string, string>,
  staff_attendance: STAFF_ATTENDANCE_FIELDS as unknown as Record<string, string>,
  daily_activity_records: FIELD_MAP_DAILY_ACTIVITY as unknown as Record<string, string>,
  handoff: FIELD_MAP_HANDOFF as unknown as Record<string, string>,
};

// ---------------------------------------------------------------------------
// Step2 補助: 型チェック定義
// ---------------------------------------------------------------------------

/** JS想定型 → 許容される SharePoint TypeAsString 一覧 */
const TYPE_EXPECTATIONS: Record<string, string[]> = {
  number:  ['Number', 'Lookup', 'Counter', 'Currency'],
  string:  ['Text', 'Note', 'Choice', 'MultiChoice', 'Computed'],
  boolean: ['Boolean'],
  date:    ['DateTime'],
};

/**
 * SharePoint InternalName → アプリが想定する JS 型
 * ここに登録しておくと Step2 で自動型チェックされる。
 * 発見次第追加していく運用想定。
 */
const FIELD_TYPE_HINTS: Record<string, string> = {
  // ── Numeric / Lookup IDs ──
  'UserId': 'number',
  'UserGroupId': 'number',
  'StaffId': 'number',
  'ServiceTypeId': 'number',
  'FacilityId': 'number',
  'OrgId': 'number',
  // ── Dates ──
  'RecordDate': 'date',
  'StartDate': 'date',
  'EndDate': 'date',
  'EventDate': 'date',
  'BirthDate': 'date',
  // ── Booleans ──
  'IsActive': 'boolean',
  'IsDeleted': 'boolean',
};

// ---------------------------------------------------------------------------
// Step3: SELECT検証ターゲット（FIELD_MAPから生成した$selectが実際に通るか）
// ---------------------------------------------------------------------------
interface SelectCheckResult {
  listKey: string;
  listName: string;
  selectFields: string;
  fieldCount: number;
  status: 'ok' | 'fail' | 'pending';
  httpStatus?: number;
  error?: string;
  sampleCount?: number;
}

const SELECT_TARGETS: Array<{ listKey: string; label: string; selectFields: readonly string[] }> = [
  { listKey: 'users_master',           label: 'Users_Master',           selectFields: USERS_SELECT_FIELDS_CORE },
  { listKey: 'staff_master',           label: 'Staff_Master',           selectFields: STAFF_SELECT_FIELDS_CANONICAL },
  { listKey: 'staff_attendance',       label: 'Staff_Attendance',       selectFields: STAFF_ATTENDANCE_SELECT_FIELDS },
  { listKey: 'daily_activity_records', label: 'DailyActivityRecords',   selectFields: DAILY_ACTIVITY_SELECT_FIELDS },
  { listKey: 'handoff',                label: 'Handoff',                selectFields: buildHandoffSelectFields() },
  { listKey: 'schedule_events',        label: 'Schedules',              selectFields: SCHEDULES_BASE_FIELDS },
  { listKey: 'attendance_users',       label: 'Attendance_Users',       selectFields: ATTENDANCE_USERS_SELECT_FIELDS },
  { listKey: 'attendance_daily',       label: 'Attendance_Daily',       selectFields: ATTENDANCE_DAILY_SELECT_FIELDS },
  { listKey: 'service_provision_records', label: 'ServiceProvision',    selectFields: SERVICE_PROVISION_SELECT_FIELDS },
  { listKey: 'org_master',             label: 'Org_Master',             selectFields: ORG_MASTER_SELECT_FIELDS },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OpeningVerificationPage() {
  const { instance, accounts } = useMsal();

  // Step1: List existence
  const [healthResult, setHealthResult] = useState<HealthCheckSummary | null>(null);
  const [healthRunning, setHealthRunning] = useState(false);

  // Step2: Field check
  const [fieldResults, setFieldResults] = useState<FieldCheckResult[]>([]);
  const [fieldRunning, setFieldRunning] = useState(false);

  // Step3: SELECT query verification
  const [selectResults, setSelectResults] = useState<SelectCheckResult[]>([]);
  const [selectRunning, setSelectRunning] = useState(false);

  // Step4: CRUD
  const [crudResults, setCrudResults] = useState<CrudResult[]>([]);
  const [crudRunning, setCrudRunning] = useState(false);

  // Shared log
  const [logs, setLogs] = useState<string[]>([]);
  const log = useCallback((msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ja-JP')}] ${msg}`]), []);

  // ── Helper: get authenticated fetcher ──
  const getFetcher = async () => {
    if (accounts.length === 0) throw new Error('No MSAL account. Please login first.');
    const env = getAppConfig();
    const account = accounts[0];
    const tokenResponse = await instance.acquireTokenSilent({
      scopes: [env.VITE_SP_SCOPE_DEFAULT || 'https://isogokatudouhome.sharepoint.com/AllSites.Read'],
      account,
    });
    const token = tokenResponse.accessToken;
    const siteBaseUrl = env.VITE_SP_RESOURCE + env.VITE_SP_SITE_RELATIVE;

    return async (path: string, init?: RequestInit): Promise<Response> => {
      const url = path.startsWith('http') ? path : `${siteBaseUrl}${path}`;
      return fetch(url, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string>),
          Authorization: `Bearer ${token}`,
          Accept: 'application/json;odata=nometadata',
        },
      });
    };
  };

  // ═══════════════════════════════════════════════════════════════
  // Step 1: List Existence Check
  // ═══════════════════════════════════════════════════════════════
  const runStep1 = async () => {
    setHealthRunning(true);
    setHealthResult(null);
    log('📋 Step1: リスト存在確認開始...');
    try {
      const fetcher = await getFetcher();
      const day0Entries = SP_LIST_REGISTRY.filter(e => DAY0_REQUIRED_KEYS.includes(e.key));
      const result = await checkAllLists(fetcher, day0Entries);
      setHealthResult(result);
      log(`📋 Step1完了: ${result.ok}/${result.total} OK, ${result.notFound} 未発見, ${result.forbidden} 権限不足`);
    } catch (err) {
      log(`❌ Step1エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setHealthRunning(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Step 2: Field Verification
  // ═══════════════════════════════════════════════════════════════
  const runStep2 = async () => {
    setFieldRunning(true);
    setFieldResults([]);
    log('🔍 Step2: フィールド照合開始...');
    try {
      const fetcher = await getFetcher();
      const results: FieldCheckResult[] = [];

      for (const [listKey, fieldMap] of Object.entries(FIELD_MAPS)) {
        const entry = SP_LIST_REGISTRY.find(e => e.key === listKey);
        if (!entry) continue;
        const listName = entry.resolve();
        log(`  🔎 ${entry.displayName} (${listName}) のフィールド確認中...`);

        // Get actual fields from tenant
        const listPath = listName.toLowerCase().startsWith('guid:')
          ? `/_api/web/lists(guid'${listName.slice(5).trim()}')/fields?$filter=Hidden eq false&$select=InternalName,TypeAsString,Required`
          : `/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/fields?$filter=Hidden eq false&$select=InternalName,TypeAsString,Required`;

        try {
          const response = await fetcher(listPath);
          if (!response.ok) {
            log(`  ⚠️ ${listName}: HTTP ${response.status}`);
            // Mark all fields as unknown
            for (const [, spFieldName] of Object.entries(fieldMap)) {
              results.push({
                listKey, listName,
                fieldApp: spFieldName,
                fieldTenant: '(list inaccessible)',
                exists: false,
                typeMatch: null,
                tenantType: null,
                required: false,
                isLookup: false,
                status: 'missing',
              });
            }
            continue;
          }

          const data = await response.json();
          const tenantFields: Array<{ InternalName: string; TypeAsString: string; Required: boolean }> = data.value || [];
          const tenantFieldMap = new Map(tenantFields.map(f => [f.InternalName, f]));

          for (const [logicalName, spFieldName] of Object.entries(fieldMap)) {
            // Skip system fields that always exist
            if (['Id', 'Title', 'Created', 'Modified'].includes(spFieldName)) {
              results.push({
                listKey, listName,
                fieldApp: spFieldName,
                fieldTenant: spFieldName,
                exists: true,
                typeMatch: true,
                tenantType: tenantFieldMap.get(spFieldName)?.TypeAsString ?? 'system',
                required: false,
                isLookup: false,
                status: 'ok',
              });
              continue;
            }

            const tenantField = tenantFieldMap.get(spFieldName);
            if (tenantField) {
              // ── Type mismatch check ──
              const hint = FIELD_TYPE_HINTS[spFieldName];
              const allowed = hint ? (TYPE_EXPECTATIONS[hint] ?? []) : [];
              const isTypeMismatch = hint ? !allowed.includes(tenantField.TypeAsString) : false;

              if (isTypeMismatch) {
                log(`  ⚠️ ${listName}.${spFieldName}: 型不一致 — expected ${hint}(${allowed.join('/')}) actual=${tenantField.TypeAsString}`);
              }

              results.push({
                listKey, listName,
                fieldApp: spFieldName,
                fieldTenant: tenantField.InternalName,
                exists: true,
                typeMatch: !isTypeMismatch,
                tenantType: tenantField.TypeAsString,
                required: tenantField.Required,
                isLookup: tenantField.TypeAsString === 'Lookup',
                status: isTypeMismatch ? 'type_mismatch' : 'ok',
                expectedJsType: hint,
              });
            } else {
              results.push({
                listKey, listName,
                fieldApp: spFieldName,
                fieldTenant: '(not found)',
                exists: false,
                typeMatch: null,
                tenantType: null,
                required: false,
                isLookup: false,
                status: 'missing',
              });
              log(`  ❌ ${listName}.${spFieldName} (${logicalName}) が見つかりません`);
            }
          }
          // ── Required列チェック: テナント側でRequired=trueだがFIELD_MAPに含まれていない列を警告 ──
          const mappedInternalNames = new Set(Object.values(fieldMap));
          const unmappedRequired = tenantFields.filter(
            f => f.Required && !mappedInternalNames.has(f.InternalName) && !['ContentType', 'ContentTypeId'].includes(f.InternalName)
          );
          for (const f of unmappedRequired) {
            results.push({
              listKey, listName,
              fieldApp: '(unmapped)',
              fieldTenant: f.InternalName,
              exists: true,
              typeMatch: null,
              tenantType: f.TypeAsString,
              required: true,
              isLookup: f.TypeAsString === 'Lookup',
              status: 'unmapped_required',
            });
            log(`  ⚠️ ${listName}: Required列 "${f.InternalName}" がFIELD_MAPに未定義 — Create時に400エラーの原因になります`);
          }

          // ── Lookup型チェック: Lookup列を検出して警告（number送信必須） ──
          const lookupFields = tenantFields.filter(
            f => f.TypeAsString === 'Lookup' && mappedInternalNames.has(f.InternalName)
          );
          for (const f of lookupFields) {
            // 既存のresultにisLookupフラグを立てる
            const existing = results.find(r => r.listKey === listKey && r.fieldTenant === f.InternalName);
            if (existing) {
              existing.isLookup = true;
            }
            log(`  🔗 ${listName}.${f.InternalName}: Lookup型 — REST APIにはnumber(ID)で送信が必要です`);
          }

        } catch (err) {
          log(`  ❌ ${listName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      setFieldResults(results);
      const missing = results.filter(r => r.status === 'missing').length;
      const ok = results.filter(r => r.status === 'ok').length;
      const typeMismatch = results.filter(r => r.status === 'type_mismatch').length;
      const reqWarnings = results.filter(r => r.status === 'unmapped_required').length;
      const lookupWarnings = results.filter(r => r.isLookup).length;
      log(`🔍 Step2完了: ${ok} OK, ${missing} 未発見, ${typeMismatch} 型不一致, ${reqWarnings} Required警告, ${lookupWarnings} Lookup検出`);
    } catch (err) {
      log(`❌ Step2エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFieldRunning(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Step 3: SELECT Query Verification
  // ═══════════════════════════════════════════════════════════════
  const runStep3 = async () => {
    setSelectRunning(true);
    setSelectResults([]);
    log('📊 Step3: SELECTクエリ検証開始...');

    const results: SelectCheckResult[] = [];

    try {
      const fetcher = await getFetcher();

      for (const target of SELECT_TARGETS) {
        const entry = SP_LIST_REGISTRY.find(e => e.key === target.listKey);
        if (!entry) {
          log(`  ⚠️ ${target.label}: レジストリに未登録`);
          continue;
        }
        const listName = entry.resolve();
        const selectStr = target.selectFields.join(',');
        log(`  📊 ${target.label} (${target.selectFields.length}列)...`);

        const result: SelectCheckResult = {
          listKey: target.listKey,
          listName,
          selectFields: selectStr,
          fieldCount: target.selectFields.length,
          status: 'pending',
        };

        try {
          const url = `/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/items?$top=1&$select=${encodeURIComponent(selectStr)}`;
          const response = await fetcher(url);
          result.httpStatus = response.status;

          if (response.ok) {
            const data = await response.json();
            result.status = 'ok';
            result.sampleCount = (data.value || []).length;
            log(`    ✅ SELECT成功: ${target.selectFields.length}列, ${result.sampleCount}件取得`);
          } else {
            const errText = await response.text().catch(() => '');
            result.status = 'fail';
            // エラーメッセージから不正フィールド名を抽出
            const fieldMatch = errText.match(/field or property '([^']+)'/i)
              ?? errText.match(/'([^']+)' does not exist/i);
            if (fieldMatch) {
              result.error = `不正フィールド: ${fieldMatch[1]}`;
              log(`    ❌ SELECT失敗: フィールド "${fieldMatch[1]}" がテナントに存在しません`);
            } else {
              result.error = `HTTP ${response.status}: ${errText.slice(0, 150)}`;
              log(`    ❌ SELECT失敗: HTTP ${response.status}`);
            }
          }
        } catch (err) {
          result.status = 'fail';
          result.error = err instanceof Error ? err.message : String(err);
          log(`    ❌ ${target.label}: ${result.error}`);
        }

        results.push(result);
      }
    } catch (err) {
      log(`❌ Step3エラー: ${err instanceof Error ? err.message : String(err)}`);
    }

    setSelectResults(results);
    const ok = results.filter(r => r.status === 'ok').length;
    const fail = results.filter(r => r.status === 'fail').length;
    log(`📊 Step3完了: ${ok}/${results.length} 成功, ${fail} 失敗`);
    setSelectRunning(false);
  };

  // ═══════════════════════════════════════════════════════════════
  // Step 4: CRUD Verification
  // ═══════════════════════════════════════════════════════════════
  const runStep4 = async () => {
    setCrudRunning(true);
    setCrudResults([]);
    log('🧪 Step4: CRUD確認開始...');

    const targets: Array<{
      entity: string;
      listKey: string;
      selectFields: string;
      createPayload?: Record<string, unknown>;
      updateField?: string;
      updateValue?: unknown;
    }> = [
      {
        entity: 'Users',
        listKey: 'users_master',
        selectFields: 'Id,Title,UserID,FullName',
        // No create/update for master data
      },
      {
        entity: 'Daily',
        listKey: 'daily_activity_records',
        selectFields: 'Id,UserCode,RecordDate,TimeSlot,Observation',
        createPayload: {
          UserCode: '__SMOKE_TEST__',
          RecordDate: new Date().toISOString().slice(0, 10),
          TimeSlot: '09:00-10:00',
          Observation: 'A班開通テスト - 自動作成レコード',
        },
        updateField: 'Observation',
        updateValue: 'A班開通テスト - 更新済み',
      },
      {
        entity: 'Attendance',
        listKey: 'attendance_daily',
        selectFields: 'Id,UserCode,RecordDate,Status',
        // Read-only check for attendance
      },
      {
        entity: 'Handoff',
        listKey: 'handoff',
        selectFields: 'Id,Title,Message,Status,Created',
        createPayload: {
          Title: `A班開通テスト_${Date.now()}`,
          Message: 'A班開通テスト - 自動作成引継ぎ',
          Status: '未対応',
          Category: 'テスト',
          Severity: '通常',
        },
        updateField: 'Status',
        updateValue: '対応済み',
      },
      {
        entity: 'Staff Attendance',
        listKey: 'staff_attendance',
        selectFields: 'Id,StaffId,RecordDate,Status',
        // Read-only check
      },
    ];

    const results: CrudResult[] = [];

    try {
      const fetcher = await getFetcher();
      const env = getAppConfig();
      const _siteBaseUrl = env.VITE_SP_RESOURCE + env.VITE_SP_SITE_RELATIVE;

      for (const target of targets) {
        const entry = SP_LIST_REGISTRY.find(e => e.key === target.listKey);
        if (!entry) continue;
        const listName = entry.resolve();
        const listPath = `/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')`;
        log(`  🧪 ${target.entity} (${listName})...`);

        const result: CrudResult = {
          entity: target.entity,
          listName,
          read: 'pending',
          create: target.createPayload ? 'pending' : 'skip',
          update: target.updateField ? 'pending' : 'skip',
        };

        // ── READ ──
        try {
          const readResp = await fetcher(`${listPath}/items?$top=5&$select=${target.selectFields}`);
          if (readResp.ok) {
            const data = await readResp.json();
            result.read = 'ok';
            result.readCount = (data.value || []).length;
            log(`    ✅ Read: ${result.readCount} items`);
          } else {
            result.read = 'fail';
            result.readError = `HTTP ${readResp.status}`;
            log(`    ❌ Read: HTTP ${readResp.status}`);
          }
        } catch (err) {
          result.read = 'fail';
          result.readError = err instanceof Error ? err.message : String(err);
          log(`    ❌ Read: ${result.readError}`);
        }

        // ── CREATE ──
        if (target.createPayload && isWriteEnabled) {
          try {
            // Get list entity type
            const listInfoResp = await fetcher(`${listPath}?$select=ListItemEntityTypeFullName`);
            const listInfo = await listInfoResp.json();
            const entityType = listInfo.ListItemEntityTypeFullName;

            const createResp = await fetcher(`${listPath}/items`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json;odata=nometadata',
                Accept: 'application/json;odata=nometadata',
              },
              body: JSON.stringify({
                ...target.createPayload,
                __metadata: entityType ? { type: entityType } : undefined,
              }),
            });
            if (createResp.ok || createResp.status === 201) {
              const created = await createResp.json();
              result.create = 'ok';
              result.createdId = created.Id;
              log(`    ✅ Create: Id=${created.Id}`);
            } else {
              const errBody = await createResp.text().catch(() => '');
              result.create = 'fail';
              result.createError = `HTTP ${createResp.status}: ${errBody.slice(0, 200)}`;
              log(`    ❌ Create: HTTP ${createResp.status}`);
            }
          } catch (err) {
            result.create = 'fail';
            result.createError = err instanceof Error ? err.message : String(err);
            log(`    ❌ Create: ${result.createError}`);
          }
        } else if (target.createPayload && !isWriteEnabled) {
          result.create = 'skip';
          result.createError = 'WRITE_DISABLED';
          log(`    ⏭ Create: WRITE_DISABLED`);
        }

        // ── UPDATE ──
        if (target.updateField && result.createdId && isWriteEnabled) {
          try {
            const updateResp = await fetcher(`${listPath}/items(${result.createdId})`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json;odata=nometadata',
                Accept: 'application/json;odata=nometadata',
                'X-HTTP-Method': 'MERGE',
                'If-Match': '*',
              },
              body: JSON.stringify({
                [target.updateField]: target.updateValue,
              }),
            });
            if (updateResp.ok || updateResp.status === 204) {
              result.update = 'ok';
              log(`    ✅ Update: Id=${result.createdId}`);
            } else {
              result.update = 'fail';
              result.updateError = `HTTP ${updateResp.status}`;
              log(`    ❌ Update: HTTP ${updateResp.status}`);
            }
          } catch (err) {
            result.update = 'fail';
            result.updateError = err instanceof Error ? err.message : String(err);
            log(`    ❌ Update: ${result.updateError}`);
          }
        } else if (target.updateField && !result.createdId) {
          result.update = 'skip';
          result.updateError = 'No item created';
        }

        results.push(result);
      }
    } catch (err) {
      log(`❌ Step4エラー: ${err instanceof Error ? err.message : String(err)}`);
    }

    setCrudResults(results);
    const readOk = results.filter(r => r.read === 'ok').length;
    const createOk = results.filter(r => r.create === 'ok').length;
    const updateOk = results.filter(r => r.update === 'ok').length;
    log(`🧪 Step4完了: Read ${readOk}/${results.length}, Create ${createOk}, Update ${updateOk}`); // Updated log message
    setCrudRunning(false);
  };

  // ── Export all results as markdown ──
  const exportMarkdown = () => {
    const lines: string[] = [
      `# A班 Day-2 開通確認レポート`,
      `**実行日時**: ${new Date().toLocaleString('ja-JP')}`,
      `**WRITE_ENABLED**: ${isWriteEnabled ? '✅ ON' : '❌ OFF'}`,
      '',
    ];

    // Section 1: List existence
    if (healthResult) {
      lines.push('## 1. リスト存在確認', '');
      lines.push('| # | List | SP名 | Status | HTTP |');
      lines.push('|---|------|------|--------|------|');
      healthResult.results.forEach((r, i) => {
        lines.push(`| ${i+1} | ${r.displayName} | \`${r.listName}\` | ${statusIcon(r.status)} ${r.status} | ${r.httpStatus ?? '—'} |`);
      });
      lines.push('');
    }

    // Section 2: Field check
    if (fieldResults.length > 0) {
      lines.push('## 2. フィールド差分表', '');
      lines.push('| List | Field (App) | Tenant | Type | Status |');
      lines.push('|------|-------------|--------|------|--------|');
      fieldResults.forEach(r => {
        if (r.status !== 'ok') {
          const statusLabel = r.status === 'missing' ? '❌ missing'
            : r.status === 'type_mismatch' ? `⚠️ type_mismatch (expected: ${r.expectedJsType})`
            : r.status === 'unmapped_required' ? '⚠️ unmapped_required'
            : '⚠️ ' + r.status;
          lines.push(`| ${r.listKey} | \`${r.fieldApp}\` | ${r.fieldTenant} | ${r.tenantType ?? '—'} | ${statusLabel} |`);
        }
      });
      const okCount = fieldResults.filter(r => r.status === 'ok').length;
      lines.push('', `> ✅ ${okCount}/${fieldResults.length} フィールド OK`);
      lines.push('');
    }

    // Section 3: SELECT verification
    if (selectResults.length > 0) {
      lines.push('## 3. SELECTクエリ検証', '');
      lines.push('| List | 列数 | Status | HTTP | 取得件数 | エラー |');
      lines.push('|------|------|--------|------|----------|--------|');
      selectResults.forEach(r => {
        lines.push(`| \`${r.listKey}\` | ${r.fieldCount} | ${r.status === 'ok' ? '✅' : '❌'} | ${r.httpStatus ?? '—'} | ${r.sampleCount ?? '—'} | ${r.error ?? ''} |`);
      });
      const selOk = selectResults.filter(r => r.status === 'ok').length;
      lines.push('', `> ${selOk === selectResults.length ? '✅' : '⚠️'} ${selOk}/${selectResults.length} SELECT成功`);
      // Append $select details for failed queries
      const failedSelects = selectResults.filter(r => r.status === 'fail');
      if (failedSelects.length > 0) {
        lines.push('', '### 3-1. 失敗クエリの$selectフィールド', '');
        failedSelects.forEach(r => {
          lines.push(`**\`${r.listKey}\`** (${r.listName}):`);
          lines.push('```');
          lines.push(r.selectFields);
          lines.push('```');
          if (r.error) lines.push(`> ❌ ${r.error}`);
          lines.push('');
        });
      }
      lines.push('');
    }

    // Section 4: CRUD
    if (crudResults.length > 0) {
      lines.push('## 4. CRUD確認表', '');
      lines.push('| Entity | List | Read | Create | Update |');
      lines.push('|--------|------|------|--------|--------|');
      crudResults.forEach(r => {
        lines.push(`| ${r.entity} | \`${r.listName}\` | ${crudIcon(r.read)} | ${crudIcon(r.create)} | ${crudIcon(r.update)} |`);
      });
      lines.push('');
    }

    // Section 5: Issues
    const issues: string[] = [];
    if (healthResult) {
      healthResult.results.filter(r => r.status !== 'ok').forEach(r => {
        issues.push(`- **${r.displayName}** (\`${r.listName}\`): ${r.status} (HTTP ${r.httpStatus ?? '?'})`);
      });
    }
    fieldResults.filter(r => r.status !== 'ok').forEach(r => {
      issues.push(`- **${r.listKey}**.\`${r.fieldApp}\`: ${r.status}`);
    });
    selectResults.filter(r => r.status === 'fail').forEach(r => {
      issues.push(`- **SELECT**: \`${r.listKey}\` ${r.error ?? 'failed'}`);
    });
    crudResults.forEach(r => {
      if (r.readError) issues.push(`- **${r.entity}** Read: ${r.readError}`);
      if (r.createError && r.createError !== 'WRITE_DISABLED') issues.push(`- **${r.entity}** Create: ${r.createError}`);
      if (r.updateError) issues.push(`- **${r.entity}** Update: ${r.updateError}`);
    });

    if (issues.length > 0) {
      lines.push('## 5. 未解決課題一覧', '');
      issues.forEach(issue => lines.push(issue));
    } else {
      lines.push('## 5. 未解決課題一覧', '', '> 🎉 未解決課題なし');
    }

    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opening-verification-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    log('📥 マークダウンレポートをダウンロードしました');
  };

  // ── Render helpers ──
  const statusIcon = (s: ListCheckStatus): string => {
    switch (s) {
      case 'ok': return '✅';
      case 'not_found': return '❌';
      case 'forbidden': return '🔒';
      case 'error': return '⚠️';
    }
  };

  const crudIcon = (s: string): string => {
    switch (s) {
      case 'ok': return '✅';
      case 'fail': return '❌';
      case 'skip': return '⏭';
      case 'pending': return '⏳';
      default: return '—';
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════════
  const sectionStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  const btnStyle = (color: string, running: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 'bold',
    background: running ? '#ccc' : color,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: running ? 'not-allowed' : 'pointer',
    marginRight: '8px',
  });

  const thStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid #ddd',
    background: '#f5f5f5',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 600,
  };

  const tdStyle: React.CSSProperties = {
    padding: '4px 10px',
    border: '1px solid #ddd',
    fontSize: '13px',
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <WriteDisabledBanner />

      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
        🏗️ A班 開通確認コンソール
      </h1>
      <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '14px' }}>
        Day-0 必須リスト {DAY0_REQUIRED_KEYS.length} 個に対するリスト存在確認 → フィールド照合 → CRUD検証
      </p>

      {/* ── Controls ── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button style={btnStyle('#0066cc', healthRunning)} onClick={runStep1} disabled={healthRunning}>
          {healthRunning ? '確認中...' : '📋 Step1: リスト存在確認'}
        </button>
        <button style={btnStyle('#6f42c1', fieldRunning)} onClick={runStep2} disabled={fieldRunning}>
          {fieldRunning ? '照合中...' : '🔍 Step2: フィールド照合'}
        </button>
        <button style={btnStyle('#e67e22', selectRunning)} onClick={runStep3} disabled={selectRunning}>
          {selectRunning ? '検証中...' : '📊 Step3: SELECT検証'}
        </button>
        <button style={btnStyle('#28a745', crudRunning)} onClick={runStep4} disabled={crudRunning}>
          {crudRunning ? 'テスト中...' : '🧪 Step4: CRUD確認'}
        </button>
        <button style={btnStyle('#dc3545', false)} onClick={exportMarkdown}>
          📥 レポート出力
        </button>
      </div>

      {/* ── Step1 Results ── */}
      {healthResult && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            📋 Step1: リスト存在確認 ({healthResult.ok}/{healthResult.total} OK)
          </h2>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '13px' }}>
            <span>✅ OK: {healthResult.ok}</span>
            <span>❌ Not Found: {healthResult.notFound}</span>
            <span>🔒 Forbidden: {healthResult.forbidden}</span>
            <span>⚠️ Error: {healthResult.errors}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>名前</th>
                <th style={thStyle}>SPリスト名</th>
                <th style={thStyle}>HTTP</th>
                <th style={thStyle}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {healthResult.results.map((r: ListCheckResult) => (
                <tr key={r.key} style={{ background: r.status === 'ok' ? '#f9fff9' : '#fff5f5' }}>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{statusIcon(r.status)}</td>
                  <td style={tdStyle}>{r.displayName}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{r.listName}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{r.httpStatus ?? '—'}</td>
                  <td style={{ ...tdStyle, color: '#c00', fontSize: '11px' }}>{r.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Step2 Results ── */}
      {fieldResults.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            🔍 Step2: フィールド照合 ({fieldResults.filter(r => r.status === 'ok').length}/{fieldResults.length} OK)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>List</th>
                <th style={thStyle}>App Field</th>
                <th style={thStyle}>Tenant</th>
                <th style={thStyle}>Type</th>
              </tr>
            </thead>
            <tbody>
              {fieldResults.map((r, i) => (
                <tr key={`${r.listKey}-${r.fieldApp}-${i}`} style={{ background: r.status === 'ok' ? '#f9fff9' : '#fff5f5' }}>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {r.status === 'ok' ? '✅' : r.status === 'missing' ? '❌' : '⚠️'}
                  </td>
                  <td style={tdStyle}>{r.listKey}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{r.fieldApp}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{r.fieldTenant}</td>
                  <td style={{ ...tdStyle, fontSize: '12px' }}>{r.tenantType ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Step3 SELECT Results ── */}
      {selectResults.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            📊 Step3: SELECTクエリ検証 ({selectResults.filter(r => r.status === 'ok').length}/{selectResults.length} 成功)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>List</th>
                <th style={thStyle}>列数</th>
                <th style={thStyle}>HTTP</th>
                <th style={thStyle}>エラー詳細</th>
              </tr>
            </thead>
            <tbody>
              {selectResults.map(r => (
                <tr key={r.listKey} style={{ background: r.status === 'ok' ? '#f9fff9' : '#fff5f5' }}>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{r.status === 'ok' ? '✅' : '❌'}</td>
                  <td style={tdStyle}>{r.listKey}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{r.fieldCount}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{r.httpStatus ?? '—'}</td>
                  <td style={{ ...tdStyle, color: '#c00', fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.error ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Step4 CRUD Results ── */}
      {crudResults.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            🧪 Step4: CRUD確認
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Entity</th>
                <th style={thStyle}>List</th>
                <th style={thStyle}>Read</th>
                <th style={thStyle}>Create</th>
                <th style={thStyle}>Update</th>
                <th style={thStyle}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {crudResults.map(r => (
                <tr key={r.entity}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.entity}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{r.listName}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{crudIcon(r.read)} {r.readCount !== undefined ? `(${r.readCount})` : ''}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{crudIcon(r.create)} {r.createdId ? `(#${r.createdId})` : ''}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{crudIcon(r.update)}</td>
                  <td style={{ ...tdStyle, color: '#c00', fontSize: '11px' }}>
                    {[r.readError, r.createError, r.updateError].filter(Boolean).join('; ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Log Console ── */}
      <div style={{
        background: '#1e1e1e',
        color: '#d4d4d4',
        padding: '1rem',
        borderRadius: '8px',
        maxHeight: '300px',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        fontSize: '12px',
        lineHeight: '1.6',
        fontFamily: 'monospace',
      }}>
        {logs.length === 0
          ? <span style={{ color: '#666' }}>Ready. 上のボタンをクリックして開始してください。</span>
          : logs.map((l, i) => <div key={i}>{l}</div>)
        }
      </div>
    </div>
  );
}
