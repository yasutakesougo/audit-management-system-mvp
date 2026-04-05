import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import type { MeetingMinutesExportModel } from '../exportTypes';
import type { HandoffAudience } from '../../editor/handoffTemplates';
import { MeetingMinutesPrintSection } from './MeetingMinutesPrintSection';

export type MeetingMinutesPrintPreviewProps = {
  model: MeetingMinutesExportModel;
  audience?: HandoffAudience;
};

export function MeetingMinutesPrintPreview(props: MeetingMinutesPrintPreviewProps) {
  const { model, audience } = props;
  const now = new Date();
  const generatedAt = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <Box
      className="print-preview-container"
      sx={{
        // Display styling for screen
        p: 3,
        bgcolor: '#fff',
        color: '#000',
        fontFamily: '"Noto Sans JP", sans-serif',
        maxWidth: '800px',
        margin: '0 auto',

        // Print specific CSS overrides
        '@media print': {
          p: 0,
          margin: 0,
          maxWidth: '100%',
          boxShadow: 'none',
        },
      }}
    >
      {/* Print Header (Meta info) */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ borderBottom: '2px solid #000', mb: 2, pb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {model.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            出力日時: {generatedAt}
          </Typography>
        </Stack>
        
        <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Stack spacing={0.5}>
              <Typography variant="body2"><strong>日時:</strong> {model.meetingDate || '未設定'}</Typography>
              <Typography variant="body2"><strong>カテゴリ:</strong> {model.category || '未設定'}</Typography>
              {audience && <Typography variant="body2"><strong>対象:</strong> {audience === 'field' ? '現場向け' : '管理者向け'}</Typography>}
            </Stack>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack spacing={0.5}>
              <Typography variant="body2"><strong>司会:</strong> {model.chair || '未設定'}</Typography>
              <Typography variant="body2"><strong>書記:</strong> {model.scribe || '未設定'}</Typography>
              <Typography variant="body2"><strong>参加者:</strong> {model.attendees?.join(', ') || '未設定'}</Typography>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Sections */}
      <Box>
        {model.sections.length > 0 ? (
          model.sections.map((section, idx) => (
            <MeetingMinutesPrintSection key={`${section.kind}-${idx}`} section={section} />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">記録がありません。</Typography>
        )}
      </Box>

      {/* Related Links */}
      {model.relatedLinks && (
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed #ccc', pageBreakInside: 'avoid' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>関連リンク</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {model.relatedLinks}
          </Typography>
        </Box>
      )}

      {/* Footer */}
      <Box sx={{ 
        mt: 4, 
        pt: 1, 
        borderTop: '1px solid #ddd', 
        textAlign: 'center',
        '@media print': {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
        }
      }}>
        <Typography variant="caption" color="text.secondary">
          Audit Management System - {audience === 'field' ? '現場向け申し送り資料' : '管理者向け共有資料'}
        </Typography>
      </Box>
    </Box>
  );
}
