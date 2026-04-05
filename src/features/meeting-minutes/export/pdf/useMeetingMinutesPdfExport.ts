import { useCallback } from 'react';
import type { MeetingMinutesExportModel } from '../exportTypes';
import type { HandoffAudience } from '../../editor/handoffTemplates';
import { buildMeetingMinutesPdfFileName } from './buildMeetingMinutesPdfFileName';

export type PdfExportParams = {
  model: MeetingMinutesExportModel;
  audience?: HandoffAudience;
  fileName?: string;
};

/**
 * useMeetingMinutesPdfExport.ts
 *
 * 責務:
 * - HTMLプレビュー画面から「PDFとして保存・印刷」を行うアクションを提供する
 * - 印刷時のブラウザのデフォルトファイル名を上書きするため、document.title を一時的に書き換える
 * - 将来的に html2pdf などの別ライブラリへ移行する際、コンポーネントを修正せずに
 *   この hook 内の処理を差し替えるだけで済むようにする抽象レイヤー。
 */
export function useMeetingMinutesPdfExport() {
  const exportAsPdf = useCallback((params: PdfExportParams) => {
    const { model, audience, fileName } = params;

    const generatedFileName = fileName || buildMeetingMinutesPdfFileName({
      title: model.title,
      meetingDate: model.meetingDate,
      audience,
    });

    // fileName に .pdf が含まれている場合は外す (document.titleには不要なため)
    const printTitle = generatedFileName.replace(/\.pdf$/, '');

    const originalTitle = document.title;

    try {
      // document.title を上書きして window.print を呼ぶことで、
      // ユーザーが「PDFとして保存」を選んだ際のデフォルトファイル名を固定できる。
      document.title = printTitle;
      window.print();
    } finally {
      // 印刷ダイアログが閉じられた後、確実に戻す
      document.title = originalTitle;
    }
  }, []);

  return { exportAsPdf };
}
