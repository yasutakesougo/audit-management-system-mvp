import { useCallback } from 'react';
import { useSP } from '../../lib/spClient';
import type { SupportRecordInsertDTO, SupportRecordItem } from './types';

const LIST_TITLE = 'SupportRecord_Daily';
const SELECT_FIELDS = ['Id', 'Title', 'cr013_recorddate', 'cr013_specialnote'] as const;

export function useRecordsApi() {
  const { getListItemsByTitle, addListItemByTitle } = useSP();

  const list = useCallback(
    async (): Promise<SupportRecordItem[]> =>
      getListItemsByTitle<SupportRecordItem>(
        LIST_TITLE,
        [...SELECT_FIELDS],
        undefined,
        'Id desc',
        200,
      ),
    [getListItemsByTitle],
  );

  const add = useCallback(
    async (body: SupportRecordInsertDTO): Promise<SupportRecordItem> => {
      const insert: SupportRecordInsertDTO = {
        Title: body.Title,
        cr013_recorddate: body.cr013_recorddate || undefined,
        cr013_specialnote: body.cr013_specialnote || undefined,
      };
      return addListItemByTitle<SupportRecordInsertDTO, SupportRecordItem>(LIST_TITLE, insert);
    },
    [addListItemByTitle],
  );

  return { list, add };
}
