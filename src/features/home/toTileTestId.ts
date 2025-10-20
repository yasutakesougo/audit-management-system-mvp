export const toTileTestId = (to: string): string =>
  `home-tile-${to.replace(/^\//, '').replace(/[^a-z0-9-]/gi, '-')}`;
