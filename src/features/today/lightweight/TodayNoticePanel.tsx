import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import React from 'react';

export type TodayNoticePanelProps = {
  notices: string[];
};

export const TodayNoticePanel: React.FC<TodayNoticePanelProps> = ({ notices }) => {
  const visibleNotices = notices.slice(0, 3);

  return (
    <Accordion defaultExpanded={false} data-testid="today-lite-notice-panel">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" fontWeight={700}>注意事項・お知らせ</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {visibleNotices.length === 0 ? (
          <Typography variant="body2" color="text.secondary">お知らせはありません</Typography>
        ) : (
          <List dense disablePadding>
            {visibleNotices.map((notice) => (
              <ListItem key={notice} disablePadding>
                <ListItemText primary={notice} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItem>
            ))}
          </List>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default TodayNoticePanel;
