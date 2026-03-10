export const MOCK_USERS = [
  { id: 'U001', name: '吉田 卓' },
  { id: 'U002', name: '田中 太郎' },
  { id: 'U003', name: '鈴木 花子' },
  { id: 'U004', name: '佐藤 一郎' },
  { id: 'U005', name: '高橋 美咲' },
  { id: 'U006', name: '山田 健二' },
  { id: 'U007', name: '渡辺 愛子' },
  { id: 'U008', name: '伊藤 誠' },
  { id: 'U009', name: '中村 さくら' },
  { id: 'U010', name: '小林 大輔' },
] as const;

export const CELL_BORDER = '1px solid #333';
export const HEADER_BG = '#e8e8e8';
export const WEEKEND_BG = '#f5f5f5';
export const ABSENT_BG = '#fff3e0';
export const SIGN_CELL_BORDER = '1px solid #333';

export const cellSx = {
  borderRight: CELL_BORDER,
  borderBottom: CELL_BORDER,
  px: 0.5,
  py: 0.25,
  fontSize: 11,
  lineHeight: 1.3,
  whiteSpace: 'nowrap' as const,
} as const;

export const headerCellSx = {
  ...cellSx,
  bgcolor: HEADER_BG,
  fontWeight: 700,
  textAlign: 'center' as const,
  position: 'sticky' as const,
  top: 0,
  zIndex: 2,
} as const;

export function toJapaneseEra(year: number): string {
  // Reiwa era started 2019
  const reiwaYear = year - 2018;
  if (reiwaYear >= 1) return `令和${reiwaYear}年度`;
  return `${year}年度`;
}

export function getDowColor(dow: string): string {
  if (dow === '日') return '#d32f2f';
  if (dow === '土') return '#1565c0';
  return '#333';
}
