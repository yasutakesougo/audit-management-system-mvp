import type { UserProfile } from '../types/userProfile';

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const { userProfileExample } = await import('../mocks/userProfile.example');
  return {
    ...userProfileExample,
    id: userId,
  };
};

export const upsertUserProfile = async (_profile: UserProfile): Promise<void> => {
  // TODO: replace with real API call (SharePoint / Dataverse / Firestore).
};
