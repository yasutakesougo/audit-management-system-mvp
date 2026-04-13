/**
 * markdownExport — P2-A: buildSupportPlanMarkdown テスト
 *
 * ExportModel（form + compliance + deadlines）から
 * 正しく Markdown セクションが生成されることを検証する。
 */
import { describe, expect, it } from 'vitest';
import type { IspComplianceMetadata } from '@/domain/isp/schema';
import type { DeadlineInfo, SupportPlanForm } from '../../types';
import { defaultFormState } from '../../types';
import { buildSupportPlanMarkdown, type SupportPlanExportModel } from '../markdownExport';

// ── Helpers ──

const makeForm = (overrides: Partial<SupportPlanForm>): SupportPlanForm => ({
  ...defaultFormState,
  ...overrides,
});

const makeDeadline = (overrides: Partial<DeadlineInfo> = {}): DeadlineInfo => ({
  label: 'テスト期限',
  color: 'default',
  ...overrides,
});

const makeCompliance = (overrides: Partial<IspComplianceMetadata> = {}): IspComplianceMetadata => ({
  serviceType: 'other',
  standardServiceHours: null,
  consent: {
    explainedAt: null,
    explainedBy: '',
    consentedAt: null,
    consentedBy: '',
    proxyName: '',
    proxyRelation: '',
    notes: '',
  },
  delivery: {
    deliveredAt: null,
    deliveredToUser: false,
    deliveredToConsultationSupport: false,
    deliveryMethod: '',
    notes: '',
  },
  reviewControl: {
    reviewCycleDays: 180,
    lastReviewedAt: null,
    nextReviewDueAt: null,
    reviewReason: '',
  },
  approval: {
    approvedBy: null,
    approvedAt: null,
    approvalStatus: 'draft',
  },
  meeting: {
    meetingDate: null,
    meetingMinutes: '',
    attendees: [],
  },
  consultationSupport: {
    agencyName: '',
    officerName: '',
    serviceUsePlanReceivedAt: null,
    gapNotes: '',
  },
  ...overrides,
});

const makeModel = (overrides: Partial<SupportPlanExportModel> = {}): SupportPlanExportModel => ({
  form: makeForm({}),
  compliance: null,
  deadlines: {
    creation: makeDeadline({ label: '作成期限(開始+30日)' }),
    monitoring: makeDeadline({ label: '次回モニタ期限(6か月)' }),
  },
  ...overrides,
});

// ── Tests ──

describe('buildSupportPlanMarkdown — P2-A 統合出力', () => {
  it('compliance が null でも既存の form セクションは正常に出力される', () => {
    const model = makeModel({
      form: makeForm({ serviceUserName: '田中太郎', supportLevel: '支援区分3' }),
      compliance: null,
    });
    const md = buildSupportPlanMarkdown(model);
    expect(md).toContain('利用者名: 田中太郎');
    expect(md).toContain('支援区分 / 医療等: 支援区分3');
    // compliance section should not appear when null
    expect(md).not.toContain('制度適合');
  });

  it('同意記録が Markdown に含まれる', () => {
    const model = makeModel({
      compliance: makeCompliance({
        consent: {
          explainedAt: '2025-04-01T10:00:00Z',
          explainedBy: '山田花子',
          consentedAt: '2025-04-02T14:00:00Z',
          consentedBy: '田中太郎',
          proxyName: '',
          proxyRelation: '',
          notes: '',
        },
      }),
    });
    const md = buildSupportPlanMarkdown(model);
    expect(md).toContain('## 制度適合（コンプライアンス）');
    expect(md).toContain('### 同意記録');
    expect(md).toContain('説明実施者: 山田花子');
    expect(md).toContain('同意者: 田中太郎');
  });

  it('代理人情報が含まれる（続柄付き）', () => {
    const model = makeModel({
      compliance: makeCompliance({
        consent: {
          explainedAt: '2025-04-01',
          explainedBy: '支援者A',
          consentedAt: '2025-04-02',
          consentedBy: '家族B',
          proxyName: '代理人C',
          proxyRelation: '母',
          notes: '',
        },
      }),
    });
    const md = buildSupportPlanMarkdown(model);
    expect(md).toContain('代理人: 代理人C（母）');
  });

  it('交付記録が正しく出力される', () => {
    const model = makeModel({
      compliance: makeCompliance({
        delivery: {
          deliveredAt: '2025-04-05T09:00:00Z',
          deliveredToUser: true,
          deliveredToConsultationSupport: false,
          deliveryMethod: '手渡し',
          notes: '',
        },
      }),
    });
    const md = buildSupportPlanMarkdown(model);
    expect(md).toContain('### 交付記録');
    expect(md).toContain('本人への交付: ✓ 済');
    expect(md).toContain('相談支援専門員への交付: ✗ 未');
    expect(md).toContain('交付方法: 手渡し');
  });

  it('承認済みの場合、承認記録が出力される', () => {
    const model = makeModel({
      compliance: makeCompliance({
        approval: {
          approvedBy: 'admin@example.com',
          approvedAt: '2025-04-10T12:00:00Z',
          approvalStatus: 'approved',
        },
      }),
    });
    const md = buildSupportPlanMarkdown(model);
    expect(md).toContain('### 承認記録');
    expect(md).toContain('ステータス: ✓ 承認済み');
    expect(md).toContain('承認者: admin@example.com');
  });

  it('下書き状態の場合、承認ステータスが「下書き」と表示される', () => {
    const model = makeModel({
      compliance: makeCompliance({
        approval: {
          approvedBy: null,
          approvedAt: null,
          approvalStatus: 'draft',
        },
      }),
    });
    const md = buildSupportPlanMarkdown(model);
    expect(md).toContain('ステータス: 下書き');
    expect(md).not.toContain('承認者:');
  });

  it('期限情報セクションが出力される（残日数あり）', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    const model = makeModel({
      deadlines: {
        creation: makeDeadline({
          label: '作成期限(開始+30日)',
          date: futureDate,
          daysLeft: 15,
          color: 'success',
        }),
        monitoring: makeDeadline({
          label: '次回モニタ期限(6か月)',
          date: undefined,
          daysLeft: undefined,
          color: 'default',
        }),
      },
    });
    const md = buildSupportPlanMarkdown(model);
    expect(md).toContain('## 期限管理');
    expect(md).toContain('作成期限(開始+30日)');
    expect(md).toContain('残り 15日');
    expect(md).toContain('次回モニタ期限(6か月)');
    expect(md).toContain('未設定');
  });

  it('期限超過の場合、超過日数が表示される', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const model = makeModel({
      deadlines: {
        creation: makeDeadline({
          label: '作成期限(開始+30日)',
          date: pastDate,
          daysLeft: -5,
          color: 'error',
        }),
        monitoring: makeDeadline({
          label: '次回モニタ期限(6か月)',
          date: new Date(),
          daysLeft: 0,
          color: 'warning',
        }),
      },
    });
    const md = buildSupportPlanMarkdown(model);
    expect(md).toContain('⚠ 5日超過');
    expect(md).toContain('⚠ 本日期限');
  });

  it('goals も compliance も含む統合出力が正しく生成される', () => {
    const model = makeModel({
      form: makeForm({
        serviceUserName: '鈴木一郎',
        goals: [
          { id: '1', type: 'long', label: '長期A', text: '自立生活を目指す', domains: [] },
        ],
      }),
      compliance: makeCompliance({
        consent: {
          explainedAt: '2025-04-01',
          explainedBy: '相談員A',
          consentedAt: '2025-04-02',
          consentedBy: '鈴木一郎',
          proxyName: '',
          proxyRelation: '',
          notes: '',
        },
        approval: {
          approvedBy: 'sabikan@example.com',
          approvedAt: '2025-04-05',
          approvalStatus: 'approved',
        },
      }),
    });
    const md = buildSupportPlanMarkdown(model);
    // form sections
    expect(md).toContain('利用者名: 鈴木一郎');
    expect(md).toContain('**長期A**: 自立生活を目指す');
    // compliance sections
    expect(md).toContain('説明実施者: 相談員A');
    expect(md).toContain('✓ 承認済み');
    // deadline sections
    expect(md).toContain('## 期限管理');
  });
});
