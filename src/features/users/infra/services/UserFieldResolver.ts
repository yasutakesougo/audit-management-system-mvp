import { 
  resolveInternalNamesDetailed
} from '@/lib/sp/helpers';
import {
  USERS_MASTER_CANDIDATES,
  USERS_MASTER_CORE_FIELD_MAP,
  USERS_MASTER_COMPLIANCE_FIELD_MAP,
  USERS_MASTER_ESSENTIALS,
  USER_BENEFIT_PROFILE_CANDIDATES,
  USER_BENEFIT_PROFILE_ESSENTIALS,
} from '@/sharepoint/fields';
import { auditLog } from '@/lib/debugLogger';
import { emitDriftRecord, type DriftResolutionType, type DriftType } from '@/features/diagnostics/drift/domain/driftLogic';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  resolveUserBenefitProfileCutoverStage,
  type CutoverStageValue,
} from '../migration/userBenefitProfileCutover';
import { AuthRequiredError } from '@/lib/errors';

export interface UserFieldStatus {
  resolvedName?: string;
  candidates: string[];
  isSilent?: boolean;
  isEssential?: boolean;
}

const isAuthRequiredLike = (error: unknown): boolean => {
  if (error instanceof AuthRequiredError) return true;
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return (
    error.name === 'AuthRequiredError' ||
    error.message === 'AUTH_REQUIRED' ||
    code === 'AUTH_REQUIRED'
  );
};

/**
 * UserFieldResolver
 * 
 * Users_Master リストおよび関連リストの物理列名解決を担当する。
 * フィールドドリフトの検知とログ出力も行う。
 */
export class UserFieldResolver {
  private resolvedFields: Record<string, string | undefined> | null = null;
  private fieldStatus: Record<string, UserFieldStatus> | null = null;
  private resolvingPromise: Promise<Record<string, string | undefined> | null> | null = null;
  private cachedBenefitCutoverStage: CutoverStageValue | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string
  ) {}

  public async resolveMainFields(): Promise<Record<string, string | undefined> | null> {
    if (this.resolvedFields) return this.resolvedFields;
    if (this.resolvingPromise) return this.resolvingPromise;

    this.resolvingPromise = (async () => {
      try {
        const available = await this.provider.getFieldInternalNames(this.listTitle);
        const candidatesMap: Record<string, string[]> = {
          ...(USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>),
        };
        
        Object.entries(USERS_MASTER_CORE_FIELD_MAP).forEach(([key, val]) => {
          if (!candidatesMap[key]) candidatesMap[key] = [String(val)];
        });
        Object.entries(USERS_MASTER_COMPLIANCE_FIELD_MAP).forEach(([key, val]) => {
          if (!candidatesMap[key]) candidatesMap[key] = [String(val)];
        });

        const essentialsSet = new Set(USERS_MASTER_ESSENTIALS as string[]);
        const { resolved, fieldStatus: rawFieldStatus } = resolveInternalNamesDetailed(
          available,
          candidatesMap,
          {
            onDrift: (fieldName, resolutionType, driftType) => {
              const isEssential = essentialsSet.has(fieldName as string);
              if (isEssential) {
                emitDriftRecord(this.listTitle, fieldName, resolutionType as DriftResolutionType, driftType as DriftType, undefined, 'warn');
              } else {
                // Silent drift: log to internal auditLog only, no persistent event
                auditLog.info('users:drift', `Silent drift detected in non-essential field "${fieldName}".`, { resolutionType, driftType });
              }
            }
          }
        );
        this.fieldStatus = Object.fromEntries(
          Object.entries(rawFieldStatus).map(([key, status]) => [
            key,
            { 
              ...(status as { resolvedName?: string; candidates: string[] }), 
              isSilent: !essentialsSet.has(key),
              isEssential: essentialsSet.has(key)
            }
          ])
        ) as Record<string, UserFieldStatus>;

        this.resolvedFields = resolved as Record<string, string | undefined>;

        return this.resolvedFields;
      } catch (err) {
        if (isAuthRequiredLike(err)) {
          throw err;
        }
        auditLog.warn('users', 'Field resolution failed.', err);
        return null;
      }
    })();

    return this.resolvingPromise;
  }

  public async resolveAccessoryFields(
    listTitle: string, 
    candidates: Record<string, string[]>,
    essentials: string[] = []
  ): Promise<{ resolvedFields: Record<string, string | undefined>, resolvedKeys: Set<string> }> {
    try {
      const available = await this.provider.getFieldInternalNames(listTitle);
      const { resolved } = resolveInternalNamesDetailed(available, candidates);
      
      const bestEffort: Record<string, string | undefined> = {};
      const resolvedKeys = new Set<string>();

      const hasAnyResolved = Object.values(resolved).some(v => typeof v === 'string' && v.length > 0);

      for (const [key, cands] of Object.entries(candidates)) {
        if (resolved[key]) {
          bestEffort[key] = resolved[key] as string;
          resolvedKeys.add(key);
        } else if (essentials.includes(key)) {
          bestEffort[key] = cands[0];
        } else if (!hasAnyResolved) {
          // スキーマ情報が十分に観測できない初期状態（例: 空リスト）では
          // optional も primary 候補へ best-effort でフォールバックして write を阻害しない。
          bestEffort[key] = cands[0];
        } else {
          bestEffort[key] = undefined;
        }
      }

      return { resolvedFields: bestEffort, resolvedKeys };
    } catch (err) {
      if (isAuthRequiredLike(err)) {
        throw err;
      }
      const fallback: Record<string, string | undefined> = {};
      for (const [key, cands] of Object.entries(candidates)) {
        fallback[key] = essentials.includes(key) ? cands[0] : undefined;
      }
      return { resolvedFields: fallback, resolvedKeys: new Set() };
    }
  }

  public getBenefitCutoverStage(): CutoverStageValue {
    if (this.cachedBenefitCutoverStage) return this.cachedBenefitCutoverStage;
    this.cachedBenefitCutoverStage = resolveUserBenefitProfileCutoverStage();
    return this.cachedBenefitCutoverStage;
  }

  public getBenefitCandidates() {
    return Object.fromEntries(
      Object.entries(USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>).filter(
        ([key]) => key !== 'recipientCertNumber',
      ),
    ) as Record<string, string[]>;
  }

  public getBenefitEssentials() {
    return (USER_BENEFIT_PROFILE_ESSENTIALS as readonly string[]).filter(
      (key) => key !== 'recipientCertNumber',
    );
  }

  public getMainFieldStatus() {
    return this.fieldStatus;
  }

  /** @internal Test only */
  public __setBenefitCutoverStageForTest(stage: CutoverStageValue) {
    this.cachedBenefitCutoverStage = stage;
  }
}
