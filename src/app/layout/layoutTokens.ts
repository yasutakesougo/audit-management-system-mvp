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
    height: 56,
    // Safe-area aware: outer height = footer + safe-area-inset-bottom
    // Inner button area stays 56px, safe-area is padding
    heightWithSafeArea: 'calc(56px + env(safe-area-inset-bottom))',
    safeAreaPadding: 'env(safe-area-inset-bottom)',
  },
  touchTarget: {
    min: 40,
  },
} as const;

export type LayoutTokens = typeof layoutTokens;
