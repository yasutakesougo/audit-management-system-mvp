import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import {
  type ComplianceRiskFlag,
  type StaffMemberComplianceProfile,
  type StaffQualification,
} from './entities';

type TrainingTheme =
  | '虐待防止'
  | '身体拘束適正化'
  | '感染症対策'
  | '業務継続計画';

type TrainingStatus = {
  theme: TrainingTheme;
  lastTrainedOn?: string;
  dueOn: string;
  overdue: boolean;
};

export interface StaffComplianceSummary {
  profile: StaffMemberComplianceProfile;
  trainingStatus: TrainingStatus[];
  expiringQualifications: StaffQualification[];
  riskFlags: ComplianceRiskFlag[];
}

const today = new Date();

const buildTrainingStatus = (
  theme: TrainingTheme,
  lastTrainedOn?: string
): TrainingStatus => {
  if (!lastTrainedOn) {
    return {
      theme,
      lastTrainedOn: undefined,
      dueOn: addDays(today, -1).toISOString(),
      overdue: true,
    };
  }
  const last = parseISO(lastTrainedOn);
  const due = addDays(last, 365);
  return {
    theme,
    lastTrainedOn,
    dueOn: due.toISOString(),
    overdue: due.getTime() < today.getTime(),
  };
};

const toQualification = (
  name: string,
  issuedOffsetDays: number,
  expiresOffsetDays?: number
): StaffQualification => ({
  qualificationId: `${name}-${issuedOffsetDays}`,
  name,
  issuedOn: addDays(today, issuedOffsetDays).toISOString(),
  expiresOn: expiresOffsetDays != null ? addDays(today, expiresOffsetDays).toISOString() : undefined,
});

const baseProfiles: StaffMemberComplianceProfile[] = [
  {
    staffId: 'SMR-001',
    name: '佐藤 管理者',
    role: 'サービス管理責任者',
    employmentType: '常勤',
    qualifications: [
      toQualification('サービス管理責任者研修', -400, 120),
      toQualification('社会福祉士', -3000),
    ],
    lastAbusePreventionTrainingOn: addDays(today, -200).toISOString(),
    lastBcpTrainingOn: addDays(today, -380).toISOString(),
    lastPhysicalRestraintTrainingOn: addDays(today, -90).toISOString(),
  },
  {
    staffId: 'LSS-002',
    name: '田中 生活支援員',
    role: '生活支援員',
    employmentType: '常勤',
    qualifications: [
      toQualification('介護福祉士', -2500),
      toQualification('強度行動障害支援者養成研修', -180, 30),
    ],
    lastAbusePreventionTrainingOn: addDays(today, -30).toISOString(),
    lastBcpTrainingOn: addDays(today, -420).toISOString(),
    lastPhysicalRestraintTrainingOn: addDays(today, -410).toISOString(),
  },
  {
    staffId: 'NRS-003',
    name: '鈴木 看護師',
    role: '看護師',
    employmentType: '非常勤',
    qualifications: [
      toQualification('看護師免許', -5000),
      toQualification('救命救急講習', -700, 120),
    ],
    lastAbusePreventionTrainingOn: addDays(today, -500).toISOString(),
    lastBcpTrainingOn: addDays(today, -520).toISOString(),
    lastPhysicalRestraintTrainingOn: addDays(today, -60).toISOString(),
  },
  {
    staffId: 'INS-004',
    name: '高橋 指導員',
    role: '職業指導員',
    employmentType: '兼務',
    qualifications: [
      toQualification('職業指導員研修', -800, 200),
    ],
    lastAbusePreventionTrainingOn: addDays(today, -100).toISOString(),
    lastBcpTrainingOn: addDays(today, -150).toISOString(),
    lastPhysicalRestraintTrainingOn: addDays(today, -200).toISOString(),
  },
];

const buildRiskFlags = (
  profile: StaffMemberComplianceProfile,
  trainingStatus: TrainingStatus[],
  expiringQualifications: StaffQualification[]
): ComplianceRiskFlag[] => {
  const flags: ComplianceRiskFlag[] = [];
  if (expiringQualifications.length > 0) {
    flags.push({
      flagId: `${profile.staffId}-qual-expiring`,
      category: '減算リスク',
      severity: 'warning',
      message: '資格の有効期限が近づいています。',
      detectedOn: today.toISOString(),
      relatedStaffIds: [profile.staffId],
    });
  }
  const overdueTrainings = trainingStatus.filter((training) => training.overdue);
  if (overdueTrainings.length > 0) {
    flags.push({
      flagId: `${profile.staffId}-training-overdue`,
      category: '研修未実施',
      severity: 'warning',
      message: `法定研修の期限が超過しています（${overdueTrainings
        .map((t) => t.theme)
        .join('・')}）。`,
      detectedOn: today.toISOString(),
      relatedStaffIds: [profile.staffId],
    });
  }
  return flags;
};

export const getMockStaffComplianceSummaries = (): StaffComplianceSummary[] => {
  return baseProfiles.map((profile) => {
    const trainingStatus: TrainingStatus[] = [
      buildTrainingStatus('虐待防止', profile.lastAbusePreventionTrainingOn),
      buildTrainingStatus('業務継続計画', profile.lastBcpTrainingOn),
      buildTrainingStatus('身体拘束適正化', profile.lastPhysicalRestraintTrainingOn),
      buildTrainingStatus('感染症対策', undefined),
    ];

    const expiringQualifications = profile.qualifications.filter((qualification) => {
      if (!qualification.expiresOn) return false;
      const expires = parseISO(qualification.expiresOn);
      const days = differenceInCalendarDays(expires, today);
      return days >= 0 && days <= 60;
    });

    const riskFlags = buildRiskFlags(profile, trainingStatus, expiringQualifications);

    return {
      profile,
      trainingStatus,
      expiringQualifications,
      riskFlags,
    };
  });
};
