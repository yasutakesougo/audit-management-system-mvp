import type { Contract, UserMaster } from './types';

export const sampleUser: UserMaster = {
  id: 'user-001',
  name: '山田 太郎',
  recipientId: '1234567890',
  isEligibleForMealAddon: true,
  defaultServiceTime: { start: '09:00', end: '16:00' },
};

export const sampleContract: Contract = {
  userId: sampleUser.id,
  contractedVolume: 20,
  serviceYearMonth: '2025-09',
};

