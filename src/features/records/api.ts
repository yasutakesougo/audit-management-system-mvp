import { useSP } from '../../lib/spClient';
import type { SupportRecordItem, SupportRecordInsertDTO } from './types';

const LIST_TITLE = 'SupportRecord_Daily';

export function useRecordsApi() {
  const { getListItemsByTitle, addListItemByTitle } = useSP();

  async function list(): Promise<SupportRecordItem[]> {
    return getListItemsByTitle<SupportRecordItem>(
      LIST_TITLE,
      ['Id', 'Title', 'cr013_recorddate', 'cr013_specialnote'],
      undefined,
      'Id desc',
      200
    );
  }

  async function add(body: SupportRecordInsertDTO): Promise<SupportRecordItem> {
    const res = await addListItemByTitle<SupportRecordInsertDTO, SupportRecordItem>(LIST_TITLE, body);
    return res;
  }

  return { list, add };
}
