export const userCardSx = {
  card: (selected: boolean) => ({
    borderLeft: '4px solid',
    borderLeftColor: selected ? 'primary.main' : 'transparent',
    borderRadius: 1,
  }),

  content: {
    py: 0.75,
    px: 1,
    '&:last-child': { pb: 0.75 },
  },

  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    minWidth: 0,
  },

  name: {
    lineHeight: 1.2,
    minWidth: 0,
  },

  sub: {
    lineHeight: 1.2,
    minWidth: 0,
  },

  iconButton: {
    p: 0.25,
  },

  avatar: {
    width: 28,
    height: 28,
  },
} as const;
