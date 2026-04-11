import React from 'react';
import { Button, Tooltip, CircularProgress } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import { MonitoringMeetingPDF } from './MonitoringMeetingPDF';

interface MonitoringMeetingPDFActionProps {
  record: MonitoringMeetingRecord;
  userName: string;
}

export const MonitoringMeetingPDFAction: React.FC<MonitoringMeetingPDFActionProps> = ({ 
  record, 
  userName 
}) => {
  const fileName = `MonitoringMeeting_${record.meetingDate}_${userName}.pdf`;

  return (
    <PDFDownloadLink
      document={<MonitoringMeetingPDF record={record} userName={userName} />}
      fileName={fileName}
      style={{ textDecoration: 'none' }}
    >
      {({ loading, error }) => (
        <Tooltip title={error ? `エラー: ${error}` : "監査用PDFを出力"}>
          <span>
            <Button
              variant="outlined"
              color="primary"
              startIcon={loading ? <CircularProgress size={20} /> : <FileDownloadIcon />}
              disabled={loading}
              size="small"
            >
              {loading ? '準備中...' : '監査用PDF出力'}
            </Button>
          </span>
        </Tooltip>
      )}
    </PDFDownloadLink>
  );
};
