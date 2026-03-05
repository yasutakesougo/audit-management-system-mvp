export type MeetingCategory = '職員会議' | '朝会' | '夕会' | 'ケース会議' | '委員会' | 'その他';

export type MeetingMinutes = {
  id: number;
  title: string;
  meetingDate: string; // YYYY-MM-DD
  category: MeetingCategory;
  summary: string;
  decisions: string;
  actions: string;
  tags: string;
  relatedLinks: string;
  chair?: string;
  scribe?: string;
  attendees?: string[];
  isPublished?: boolean;
  created?: string;
  modified?: string;
  // 朝会・夕会専用フィールド
  staffAttendance?: string;    // 職員の出欠・配置状況
  userHealthNotes?: string;    // 利用者の体調・特記事項
};
