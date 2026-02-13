export const layoutTokens = {
  app: {
    height: '100dvh',
  },
  header: {
    height: 44,
  },
  activityBar: {
    width: 48,
  },
  sidebar: {
    width: 240,
  },
  footer: {
    height: 36,
  },
  touchTarget: {
    min: 40,
  },
} as const;

export type LayoutTokens = typeof layoutTokens;
