export type IcfCategory = 'body' | 'activity' | 'environment' | 'personal';

export type AssessmentItem = {
  id: string;
  category: IcfCategory;
  topic: string;
  status: 'strength' | 'neutral' | 'challenge';
  description: string;
};

export type SensoryProfile = {
  visual: number;
  auditory: number;
  tactile: number;
  olfactory: number;
  vestibular: number;
  proprioceptive: number;
};

export type UserAssessment = {
  id: string;
  userId: string;
  updatedAt: string;
  items: AssessmentItem[];
  sensory: SensoryProfile;
  analysisTags: string[];
};

export const createDefaultAssessment = (userId: string): UserAssessment => ({
  id: '',
  userId,
  updatedAt: new Date().toISOString(),
  items: [],
  sensory: {
    visual: 3,
    auditory: 3,
    tactile: 3,
    olfactory: 3,
    vestibular: 3,
    proprioceptive: 3,
  },
  analysisTags: [],
});
