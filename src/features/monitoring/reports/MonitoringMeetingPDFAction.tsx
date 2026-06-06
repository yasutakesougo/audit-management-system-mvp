import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import type { DocumentProps } from '@react-pdf/renderer';
import React, { useCallback, useState } from 'react';

import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';

interface MonitoringMeetingPDFActionProps {
  record: MonitoringMeetingRecord;
  userName: string;
}

export const MonitoringMeetingPDFAction: React.FC<MonitoringMeetingPDFActionProps> = ({ 
  record, 
  userName 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileName = `MonitoringMeeting_${record.meetingDate}_${userName}.pdf`;

  const handleDownload = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const [{ pdf }, { MonitoringMeetingPDF }, { registerFonts }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./MonitoringMeetingPDF'),
        import('@/lib/reports/fontRegistry'),
      ]);

      registerFonts();
      const document = React.createElement(MonitoringMeetingPDF, {
        record,
        userName,
      }) as unknown as React.ReactElement<DocumentProps>;
      const blob = await pdf(document).toBlob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [fileName, loading, record, userName]);

  return (
    <Tooltip title={error ? `エラー: ${error}` : '監査用PDFを出力'}>
      <span>
        <Button
          variant="outlined"
          color="primary"
          startIcon={loading ? <CircularProgress size={20} /> : <FileDownloadIcon />}
          disabled={loading}
          size="small"
          onClick={handleDownload}
        >
          {loading ? '準備中...' : '監査用PDF出力'}
        </Button>
      </span>
    </Tooltip>
  );
};
