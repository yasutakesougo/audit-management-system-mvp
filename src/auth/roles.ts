export type Role = 'viewer' | 'reception' | 'admin';

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 1,
  reception: 2,
  admin: 3,
};

export const canAccess = (role: Role, required: Role): boolean => {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[required];
};
