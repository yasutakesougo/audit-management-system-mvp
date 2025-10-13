import { useCallback } from 'react';
import { useSP } from '../../lib/spClient';
import { LIST_CONFIG, ListKeys } from '../../sharepoint/fields';
import type { ChecklistInsertDTO, ChecklistItem, ChecklistItemDTO } from './types';
import { mapToChecklistItem } from './types';

const LIST_TITLE = LIST_CONFIG[ListKeys.ComplianceCheckRules].title;

export function useChecklistApi() {
  const { getListItemsByTitle, addListItemByTitle } = useSP();

  const list = useCallback(async (): Promise<ChecklistItem[]> => {
    const rows = await getListItemsByTitle<ChecklistItemDTO>(
      LIST_TITLE,
      ['Id', 'Title', 'RuleID', 'RuleName', 'EvaluationLogic', 'ValidFrom', 'ValidTo', 'SeverityLevel'],
      undefined,
      undefined,
      200
    );
    return rows.map(mapToChecklistItem);
  }, []); // 依存配列を空にして、関数参照を安定化

  const add = useCallback(async (body: ChecklistInsertDTO): Promise<ChecklistItem> => {
    const created = await addListItemByTitle<ChecklistInsertDTO, ChecklistItemDTO>(LIST_TITLE, body);
    return mapToChecklistItem(created);
  }, []); // 依存配列を空にして、関数参照を安定化

  return { list, add };
}
