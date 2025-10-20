import type { UserProfile } from '../types/userProfile';

export const userProfileExample: UserProfile = {
  id: 'user001',
  personalInfo: {
    name: '山田 太郎',
    kana: 'やまだ たろう',
    birthDate: '1998-01-01',
  },
  administrativeInfo: {
    supportLevel: 3,
  },
  familyComposition: [
    {
      name: '山田 花子',
      relation: '母',
      phone: '090-xxxx',
    },
  ],
  serviceHistory: [
    {
      kind: '就B',
      org: '〇〇事業所',
      since: '2023-04-01',
    },
  ],
  medicalHistory: {
    diagnoses: ['ASD'],
    allergies: ['卵'],
  },
  lifeHistory: {
    narrative: '幼少期より…',
  },
  hopesAndGoals: {
    person: '一般就労を目指したい',
  },
  assessments: {
    strengths: ['visual_support'],
    iceberg: [],
    lastUpdated: '2024-10-01',
  },
  supportPlan: {
    activeVersion: 'bsp-user001-v2',
    shortGoals: ['朝の会で自己紹介'],
    longGoals: ['就労準備'],
  },
  legacyDocuments: [],
  updatedAt: new Date().toISOString(),
};
