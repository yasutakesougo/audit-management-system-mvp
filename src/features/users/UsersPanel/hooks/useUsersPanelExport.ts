/**
 * useUsersPanelExport
 *
 * PDF・Excel 出力ハンドラ
 */
import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import { AchievementRecordPDF } from '@/features/reports/achievement/AchievementRecordPDF';
import { useAchievementPDF } from '@/features/reports/achievement/useAchievementPDF';
import { exportMonthlySummary } from '@/features/reports/monthly/MonthlySummaryExcel';
import { pdf } from '@react-pdf/renderer';
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import React, { useCallback } from 'react';
import type { IUserMaster } from '../../types';

export type UseUsersPanelExportReturn = {
  handleExportAchievementPDF: (userId: string) => Promise<void>;
  handleExportMonthlySummary: () => Promise<void>;
};

export function useUsersPanelExport(
  data: IUserMaster[],
  setBusyId: (id: number | null) => void,
): UseUsersPanelExportReturn {
  const { prepareData: preparePDFData } = useAchievementPDF();
  const dailyRepository = useDailyRecordRepository();

  const handleExportAchievementPDF = useCallback(async (userId: string) => {
    const targetMonth = format(new Date(), 'yyyy-MM');
    const pdfData = await preparePDFData(userId, targetMonth);
    if (!pdfData) return;

    try {
      const blob = await pdf(
        React.createElement(AchievementRecordPDF, pdfData) as unknown as React.ReactElement
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `実績記録票_${pdfData.userName}_${targetMonth}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDFの生成に失敗しました。');
    }
  }, [preparePDFData]);

  const handleExportMonthlySummary = useCallback(async () => {
    const targetMonth = format(new Date(), 'yyyy-MM');
    setBusyId(-3);
    try {
      const start = startOfMonth(parseISO(`${targetMonth}-01`));
      const end = endOfMonth(start);
      const records = await dailyRepository.list({
        range: {
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        },
      });

      exportMonthlySummary({
        month: targetMonth,
        users: data.map(u => ({
          id: u.Id,
          userId: u.UserID || String(u.Id),
          name: u.FullName,
          severe: u.severeFlag || false,
          active: u.IsActive || false,
          toDays: u.TransportToDays || [],
          fromDays: u.TransportFromDays || [],
          attendanceDays: u.AttendanceDays || [],
          furigana: u.Furigana || '',
          nameKana: u.FullNameKana || '',
          certNumber: u.RecipientCertNumber || '',
          certExpiry: u.RecipientCertExpiry || '',
          highIntensitySupport: u.IsHighIntensitySupportTarget || false,
        })),
        records,
      });
    } catch (err) {
      console.error('Excel export failed:', err);
      alert('Excel出力に失敗しました。');
    } finally {
      setBusyId(null);
    }
  }, [data, dailyRepository, setBusyId]);

  return {
    handleExportAchievementPDF,
    handleExportMonthlySummary,
  };
}
