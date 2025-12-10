import ScheduleDialog from './ScheduleDialog';
import type { ExtendedScheduleForm, Schedule } from './types';

type Props = {
  open: boolean;
  initial?: ExtendedScheduleForm;
  existingSchedules?: Schedule[];
  onClose(): void;
  onSubmit(values: ExtendedScheduleForm): Promise<void>;
};

export default function OrgScheduleModal(props: Props) {
  return (
    <ScheduleDialog
      {...props}
      forcedCategory="Org"
      hideCategorySelect
    />
  );
}
