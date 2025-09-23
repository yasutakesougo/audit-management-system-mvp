import { useSP } from '../../lib/spClient';
import type { ChecklistItemDTO, ChecklistInsertDTO, ChecklistItem } from './types';
import { mapToChecklistItem } from './types';

const LIST_TITLE = 'Compliance_Checklist'; // 既存SPOリスト名に合わせてください

export function useChecklistApi() {
  const { getListItemsByTitle, addListItemByTitle } = useSP();

  async function list(): Promise<ChecklistItem[]> {
    const rows = await getListItemsByTitle<ChecklistItemDTO>(
      LIST_TITLE,
      ['Id', 'Title', 'cr013_key', 'cr013_value', 'cr013_note'],
      undefined,
      undefined,
      200
    );
    return rows.map(mapToChecklistItem);
  }

  async function add(body: ChecklistInsertDTO): Promise<ChecklistItem> {
    const created = await addListItemByTitle<ChecklistInsertDTO, ChecklistItemDTO>(LIST_TITLE, body);
    return mapToChecklistItem(created);
  }

  return { list, add };
}
