/**
 * GenericSchemaResolver.ts — SharePoint スキーマ解決の共通基盤
 *
 * Daily / ActivityDiary / MonitoringMeeting で同一だったロジックを
 * 1つのジェネリッククラスに統合。各ドメインは config で差分を注入する。
 *
 * 責務:
 * 1. リストタイトル候補からSPリストを自動発見 (resolveListPath)
 * 2. フィールド名の動的解決 + drift telemetry (getResolvedCanonicalNames)
 * 3. 必須フィールドの存在確認 (probeSchema)
 *
 * @see schemaUtils.ts — pure helper functions
 * @see helpers.ts — resolveInternalNamesDetailed
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import {
  buildListPath,
  buildListTitleCandidates,
  getHttpStatus,
  normalizeListKey,
  type SharePointResponse,
  type SharePointFieldItem,
} from './schemaUtils';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { auditLog } from '@/lib/debugLogger';
import type { DriftActionEvent, DriftEventHandler, DriftActionKind, DriftActionSeverity } from './driftEvents';

// ── Config ──────────────────────────────────────────────────────────────────

export interface SchemaResolverConfig {
  /** SP上のリストタイトル (primary) */
  listTitle: string;

  /** 追加のリストタイトル候補 (Daily のフォールバック等) */
  listTitleFallbacks?: readonly string[];

  /** フィールド候補定義 { fieldKey: ['PrimaryName', 'Fallback0', ...] } */
  candidates: Record<string, string[]>;

  /** 必須フィールドキー (candidates のキー) */
  essentials: readonly string[];

  /** テレメトリ用ラベル (例: 'Daily', 'ActivityDiary', 'MonitoringMeetings') */
  telemetryLabel: string;

  /** ドリフトイベントのハンドラ (上位層への通知用) */
  onDriftEvent?: DriftEventHandler;
}

// ── Class ───────────────────────────────────────────────────────────────────

export class GenericSchemaResolver {
  private resolvedListPath: string | null = null;
  private listPathResolutionFailed = false;
  private resolvedCanonicalNames: Record<string, string | undefined> | null = null;

  constructor(
    private readonly spFetch: SpFetchFn,
    private readonly config: SchemaResolverConfig
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * SP上の実在リストパスを動的に解決する。
   * 候補を順に試行し、essentials が揃ったリストを採用する。
   * 結果はインスタンス内にキャッシュされる。
   */
  public async resolveListPath(): Promise<string | null> {
    if (this.resolvedListPath) return this.resolvedListPath;
    if (this.listPathResolutionFailed) return null;

    const candidates = buildListTitleCandidates(
      this.config.listTitle,
      this.config.listTitleFallbacks
    );
    const availableTitles = await this.getAvailableListTitles();

    if (availableTitles) {
      const titleLookup = new Map<string, string>();
      for (const title of availableTitles) {
        titleLookup.set(title.toLowerCase(), title);
        titleLookup.set(normalizeListKey(title), title);
      }
      for (const candidate of candidates) {
        const matched =
          titleLookup.get(candidate.toLowerCase()) ??
          titleLookup.get(normalizeListKey(candidate));
        if (!matched) continue;
        const listPath = buildListPath(matched);
        const schemaProbe = await this.probeSchema(listPath);
        if (!schemaProbe.matches) continue;

        this.resolvedListPath = listPath;
        this.emitEvent('list_resolved', 'info', {
          message: `List matched: ${matched}`,
        });
        return listPath;
      }

      this.listPathResolutionFailed = true;
      this.emitEvent('list_not_found', 'error', {
        message: `None of the candidates matched in available titles: ${candidates.join(', ')}`,
      });
      return null;
    }

    // Fallback: try direct candidates
    for (const candidate of candidates) {
      const listPath = buildListPath(candidate);
      try {
        const schemaProbe = await this.probeSchema(listPath);
        if (schemaProbe.matches) {
          this.resolvedListPath = listPath;
          this.emitEvent('list_resolved', 'info', {
            message: `List inferred from probe: ${candidate}`,
          });
          return listPath;
        }
      } catch (error) {
        if (getHttpStatus(error) === 404) continue;
        throw error;
      }
    }

    this.listPathResolutionFailed = true;
    this.emitEvent('list_not_found', 'error', {
      message: `Failed to probe any candidate list paths: ${candidates.join(', ')}`,
    });
    return null;
  }

  /**
   * candidates 定義に従い、実在するフィールド内部名を動的に解決する。
   * drift (名前ズレ) を検出した場合は telemetry に記録する。
   * 結果はインスタンス内にキャッシュされる。
   */
  public async getResolvedCanonicalNames(): Promise<Record<string, string | undefined>> {
    if (this.resolvedCanonicalNames) return this.resolvedCanonicalNames;

    const listPath = await this.resolveListPath();
    if (!listPath) return {};

    const names = await this.getListFieldNames(listPath);
    if (!names) return {};

    const { telemetryLabel, candidates, essentials } = this.config;

    const res = resolveInternalNamesDetailed(
      names,
      candidates,
      {
        onDrift: (field: string, _resType: string, driftType: string, resolvedName: string) => {
          auditLog.info('sp', 'sp:fetch_fallback_success', {
            list: telemetryLabel,
            field,
            driftType,
          });
          this.emitEvent('fallback_success', 'warn', {
            canonicalField: field,
            resolvedField: resolvedName,
            driftType,
            message: `Field drift resolved: ${field} -> ${resolvedName} (${driftType})`,
          });
        },
      }
    );

    for (const missing of res.missing) {
      if ((essentials as readonly string[]).includes(missing)) {
        auditLog.error('sp', 'sp:field_missing_essential', {
          list: telemetryLabel,
          field: missing,
        });
        this.emitEvent('essential_missing', 'error', {
          canonicalField: missing,
          message: `Essential field missing: ${missing}`,
        });
      } else {
        auditLog.warn('sp', 'sp:field_missing_optional', {
          list: telemetryLabel,
          field: missing,
        });
        this.emitEvent('optional_missing', 'warn', {
          canonicalField: missing,
          message: `Optional field missing: ${missing}`,
        });
      }
    }

    this.resolvedCanonicalNames = res.resolved;
    return this.resolvedCanonicalNames;
  }

  /**
   * キャッシュをクリアし、次回呼び出し時に再解決させる。
   * テスト用。
   */
  public resetCache(): void {
    this.resolvedListPath = null;
    this.listPathResolutionFailed = false;
    this.resolvedCanonicalNames = null;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async getAvailableListTitles(): Promise<string[] | null> {
    try {
      const response = await this.spFetch('lists?$select=Title&$top=5000');
      const payload = (await response.json()) as SharePointResponse<{ Title?: string }>;
      return (payload.value ?? [])
        .map((item) => item.Title?.trim())
        .filter((title): title is string => Boolean(title));
    } catch (error) {
      if (getHttpStatus(error) === 404) return null;
      throw error;
    }
  }

  private async getListFieldNames(listPath: string): Promise<Set<string> | null> {
    try {
      const response = await this.spFetch(
        `${listPath}/fields?$select=InternalName&$top=500`
      );
      const payload = (await response.json()) as SharePointResponse<SharePointFieldItem>;
      return new Set(
        (payload.value ?? [])
          .map((field) => field.InternalName?.trim())
          .filter((name): name is string => Boolean(name))
      );
    } catch (error) {
      const status = getHttpStatus(error);
      if (status === 400 || status === 403 || status === 404) return null;
      throw error;
    }
  }

  private async probeSchema(
    listPath: string
  ): Promise<{ matches: boolean; missingFields: string[] }> {
    const names = await this.getListFieldNames(listPath);
    if (!names) return { matches: false, missingFields: [] };

    const res = resolveInternalNamesDetailed(names, this.config.candidates);
    const missingFields = (this.config.essentials as readonly string[]).filter(
      (key) => !res.resolved[key]
    );

    if (missingFields.length > 0) {
      auditLog.error('sp', 'sp:field_missing_essential', {
        list: `${this.config.telemetryLabel}Probe`,
        listPath,
        missingFields,
      });
      this.emitEvent('essential_missing', 'error', {
        message: `Probe failed for ${listPath}. Missing essentials: ${missingFields.join(', ')}`,
      });
    }

    return { matches: missingFields.length === 0, missingFields };
  }

  private emitEvent(
    kind: DriftActionKind,
    severity: DriftActionSeverity,
    payload: {
      message: string;
      canonicalField?: string;
      resolvedField?: string;
      driftType?: string;
    }
  ): void {
    if (!this.config.onDriftEvent) return;

    const event: DriftActionEvent = {
      domain: this.config.telemetryLabel.toLowerCase(),
      listKey: this.config.listTitle,
      kind,
      severity,
      ...payload,
      timestamp: new Date().toISOString(),
    };

    this.config.onDriftEvent(event);
  }
}
