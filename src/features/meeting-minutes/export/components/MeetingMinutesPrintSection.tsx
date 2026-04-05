import React from 'react';
import { Box, Typography } from '@mui/material';
import type { MeetingMinutesExportSection } from '../exportTypes';

export type MeetingMinutesPrintSectionProps = {
  section: MeetingMinutesExportSection;
};

export function MeetingMinutesPrintSection(props: MeetingMinutesPrintSectionProps) {
  const { section } = props;

  // Render logic based on properties from the export model
  let borderColor = 'grey.300';
  let titleColor = 'text.primary';
  let bgColor = 'transparent';

  // Apply emphasis
  if (section.emphasis === 'highlight') {
    borderColor = 'primary.main';
    titleColor = 'primary.main';
    bgColor = '#f0f7ff';
  } else if (section.emphasis === 'warning') {
    borderColor = 'warning.main';
    titleColor = 'warning.dark';
    bgColor = '#fff8e1';
  } else if (section.emphasis === 'info') {
    borderColor = 'info.main';
    titleColor = 'info.dark';
    bgColor = '#e3f2fd';
  }

  // Handle generic / fallback
  if (section.kind === 'generic' || section.kind === 'meta') {
    return (
      <Box sx={{ mb: 2, pageBreakInside: 'avoid' }}>
        {section.title && (
          <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 'bold' }}>
            {section.title}
          </Typography>
        )}
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
           {section.body}
        </Typography>
      </Box>
    );
  }

  const lines = section.body.split('\n');

  return (
    <Box
      sx={{
        mb: 2,
        pageBreakInside: 'avoid',
        // Instead of card boundaries, we use standard left border 
        // that's easy to read when printed in B&W or Color.
        borderLeft: '4px solid',
        borderColor,
        pl: 1.5,
        py: 0.5,
        backgroundColor: bgColor,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 'bold',
          color: titleColor,
          mb: 0.5,
        }}
      >
        {section.title}
      </Typography>

      <Box component="ul" sx={{ listStyleType: 'none', p: 0, m: 0 }}>
        {lines.map((line, idx) => {
          let prefix = '';
          if (section.bulletStyle === 'bullet') prefix = '• ';
          else if (section.bulletStyle === 'check') prefix = '☐ ';

          return (
            <Box component="li" key={idx} sx={{ display: 'flex', mb: 0.25 }}>
              {(section.bulletStyle === 'bullet' || section.bulletStyle === 'check') && (
                <Typography component="span" variant="body2" sx={{ mr: 1, color: 'text.secondary' }}>
                  {prefix}
                </Typography>
              )}
              <Typography variant="body2" sx={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                {line}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
