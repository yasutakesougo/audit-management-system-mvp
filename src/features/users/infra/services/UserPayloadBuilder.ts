import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { buildEq } from '@/sharepoint/query/builders';
import { applyBenefitCutoverWrite } from '../migration/userBenefitProfileCutover';
import type { IUserMasterCreateDto } from '../../types';
import type { UserFieldResolver } from './UserFieldResolver';
import { 
  type UserRow,
  USER_TRANSPORT_SETTINGS_CANDIDATES,
  USER_BENEFIT_PROFILE_EXT_CANDIDATES,
} from '@/sharepoint/fields';
import { sanitizeEnvValue } from '@/lib/sp/helpers';
import { readEnv } from '@/lib/env';
import { buildMappedPayload } from '@/lib/data/repositoryUtils';

const MAX_WRITE_RETRY = 8;

export class UserPayloadBuilder {
  private unsupportedWriteFields = new Set<string>();

  constructor(
    private readonly provider: IDataProvider,
    private readonly resolver: UserFieldResolver
  ) {}

  public async writeToMainList(
    listTitle: string, 
    payload: Partial<IUserMasterCreateDto>, 
    op: 'create' | 'update', 
    id?: number
  ): Promise<UserRow> {
    const mapping = await this.resolver.resolveMainFields();
    if (!mapping) throw new Error('Schema resolution failed');

    // 送信データの構築
    let request = buildMappedPayload({ input: payload as Record<string, unknown>, mapping });

    // 分離先リストのフィールドをメインリストへの送信から除外する
    const [transportMapping, benefitMapping, benefitExtMapping] = await Promise.all([
      this.resolver.resolveAccessoryFields(
        sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_TRANSPORT', '')) || 'UserTransport_Settings',
        USER_TRANSPORT_SETTINGS_CANDIDATES as any
      ),
      this.resolver.resolveAccessoryFields(
        sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_BENEFIT', '')) || 'UserBenefit_Profile',
        this.resolver.getBenefitCandidates()
      ),
      this.resolver.resolveAccessoryFields(
        sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_BENEFIT_EXT', '')) || 'UserBenefit_Profile_Ext',
        USER_BENEFIT_PROFILE_EXT_CANDIDATES as any
      )
    ]);

    const accessoryPhysicalFields = new Set([
      ...Object.values(transportMapping.resolvedFields).filter((v): v is string => !!v),
      ...Object.values(benefitMapping.resolvedFields).filter((v): v is string => !!v),
      ...Object.values(benefitExtMapping.resolvedFields).filter((v): v is string => !!v)
    ]);

    const filteredRequest: Record<string, unknown> = {};
    let hasEffectiveChanges = false;

    for (const [key, value] of Object.entries(request)) {
      // UserID (join key) はメインリストにも物理的に存在し必須なので、除外対象から外すが、これ単体では「変更」とはみなさない
      if (!accessoryPhysicalFields.has(key) || key === 'UserID') {
        filteredRequest[key] = value;
        if (key !== 'UserID') {
          hasEffectiveChanges = true;
        }
      }
    }

    // 最終的な未サポートフィールドと動的スキーマによるフィルタ
    request = this.filterUnsupportedFields(filteredRequest);

    // No-op guard for update
    if (op === 'update' && !hasEffectiveChanges) {
      return { Id: id } as UserRow;
    }

    for (let attempt = 0; attempt < MAX_WRITE_RETRY; attempt++) {
      try {
        if (op === 'create') {
          return await this.provider.createItem<UserRow>(listTitle, request);
        } else {
          return await this.provider.updateItem<UserRow>(listTitle, id!, request);
        }
      } catch (error) {
        const retryField = this.resolveRetryField(error, request);
        if (!retryField) throw error;
        
        this.unsupportedWriteFields.add(retryField);
        request = { ...request };
        delete request[retryField];
      }
    }
    throw new Error(`${op} failed after retries`);
  }

  public async syncAccessoryList(
    listTitle: string, 
    userId: string, 
    payload: Partial<IUserMasterCreateDto>, 
    type: 'transport' | 'benefit' | 'benefit_ext',
    mapping: Record<string, string | undefined>
  ): Promise<void> {
    const physicalUserId = mapping.userId || 'UserID';
    let request = buildMappedPayload({ input: payload as Record<string, unknown>, mapping });

    if (type === 'benefit') {
      const stage = this.resolver.getBenefitCutoverStage();
      request = applyBenefitCutoverWrite(request, payload as any, stage);
    }

    // UserID を除いた実データがあるか確認
    const hasEffectiveData = Object.keys(request).some(k => k !== physicalUserId);
    if (!hasEffectiveData) {
      return;
    }

    // UserID を確実にセット
    request[physicalUserId] = userId;

    const filter = buildEq(physicalUserId, userId);
    const existing = await this.provider.listItems<Record<string, unknown>>(listTitle, { filter, top: 1 });

    if (existing.length > 0) {
      const id = existing[0].Id || existing[0].id || existing[0].ID;
      if (id !== undefined && id !== null) {
        await this.provider.updateItem(listTitle, id as any, request);
      }
    } else {
      await this.provider.createItem(listTitle, request);
    }
  }


  private filterUnsupportedFields(request: Record<string, any>): Record<string, any> {
    const filtered = { ...request };
    for (const field of this.unsupportedWriteFields) {
      delete filtered[field];
    }
    return filtered;
  }

  private resolveRetryField(error: any, request: Record<string, any>): string | null {
    const msg = String(error?.message || '');
    if (msg.includes('does not exist') || msg.includes('Invalid column')) {
      for (const physicalName of Object.keys(request)) {
        if (msg.includes(`'${physicalName}'`) || msg.includes(`"${physicalName}"`)) {
          return physicalName;
        }
      }
    }
    return null;
  }
}
