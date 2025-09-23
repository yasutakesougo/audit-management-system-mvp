export const SP_FIELDS = {
  title: 'Title',
  recordDate: 'cr013_recorddate',
  specialNote: 'cr013_specialnote'
} as const;

// UI-friendly shape currently used in the component (kept for backward compatibility if needed)
export interface RecordItem {
  id: string;
  title: string;
  recordDate: string;
  specialNote: string;
}

// SharePoint list item (raw fields) after retrieval
export interface SupportRecordItem {
  Id: number;
  Title: string;
  cr013_recorddate?: string | null; // ISO yyyy-MM-dd or null
  cr013_specialnote?: string | null;
}

// DTO for insertion (what we send to SharePoint)
export interface SupportRecordInsertDTO {
  Title: string;
  cr013_recorddate?: string | null;
  cr013_specialnote?: string | null;
}

export function mapToRecordItem(item: SupportRecordItem): RecordItem {
  return {
    id: String(item.Id),
    title: item.Title,
    recordDate: item.cr013_recorddate || '',
    specialNote: item.cr013_specialnote || ''
  };
}
