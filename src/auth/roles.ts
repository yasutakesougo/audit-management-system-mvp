export type Role = 'viewer' | 'reception' | 'admin';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ROLE_LEVEL: Record<Role, number> = {
  viewer: 1,
  reception: 2,
  admin: 3,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const canAccess = (_role: Role, _required: Role): boolean => {
  // 全メニュー開放モード — 元のロジック: ROLE_LEVEL[role] >= ROLE_LEVEL[required]
  return true;
};
