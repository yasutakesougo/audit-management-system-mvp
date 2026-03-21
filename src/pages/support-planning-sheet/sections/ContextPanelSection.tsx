import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import Fab from '@mui/material/Fab';
import { ContextPanel } from '@/features/context/components/ContextPanel';
import type { ContextPanelData } from '@/features/context/domain/contextPanelLogic';
import { CONTEXT_PANEL_FAB_SX } from '../constants';

type ContextPanelSectionProps = {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
  userName: string;
  data: ContextPanelData;
};

export function ContextPanelSection({
  open,
  onClose,
  onToggle,
  userName,
  data,
}: ContextPanelSectionProps) {
  return (
    <>
      <ContextPanel
        open={open}
        onClose={onClose}
        userName={userName}
        data={data}
      />

      <Fab
        color="primary"
        aria-label="コンテキスト参照"
        size="medium"
        onClick={onToggle}
        data-testid="context-panel-toggle"
        sx={CONTEXT_PANEL_FAB_SX}
      >
        <AutoStoriesIcon />
      </Fab>
    </>
  );
}
