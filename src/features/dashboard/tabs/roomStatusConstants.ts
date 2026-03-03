/**
 * RoomStatusTab — Constants and helper functions.
 * Extracted from RoomStatusTab.tsx for testability.
 */

export interface Reservation {
  id: number;
  date: string;
  room: string;
  slot: 'AM' | 'PM';
  group: string;
  detail: string;
}

export const ROOMS = ['プレイルーム', '和室（中）', '和室（小）'];
export const SLOTS = ['AM', 'PM'];
export const GROUPS = ['生活支援', 'さつき会', 'リバティ', '日中', '会議', '来客', 'その他'];

// グループごとのカラーマッピング
export const GROUP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '生活支援': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  'さつき会': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  'リバティ': { bg: '#ede9fe', text: '#5b21b6', border: '#d8b4fe' },
  '日中': { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  '会議': { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
  '来客': { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' },
  'その他': { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
};

// 部屋名を短縮表示
export const getRoomAbbr = (room: string): string => {
  const map: Record<string, string> = {
    'プレイルーム': 'プ',
    '和室（中）': '和',
    '和室（小）': '小',
  };
  return map[room] || room[0];
};

// 日付を YYYY-MM-DD 形式で取得
export const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};
