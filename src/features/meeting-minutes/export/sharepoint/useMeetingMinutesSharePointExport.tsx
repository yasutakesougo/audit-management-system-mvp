import { useState, useCallback } from 'react';
import { useSP } from '@/lib/spClient';
import type { MeetingMinutesExportModel } from '../exportTypes';
import type { HandoffAudience } from '../../editor/handoffTemplates';
import { buildMeetingMinutesPdfFileName } from '../pdf/buildMeetingMinutesPdfFileName';
import { uploadMeetingMinutesExport, type UploadResult } from './uploadMeetingMinutesExport';
import { buildMeetingMinutesSharePointLink } from './buildMeetingMinutesSharePointLink';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { MeetingMinutesPrintPreview } from '../components/MeetingMinutesPrintPreview';

export type SharePointExportParams = {
  model: MeetingMinutesExportModel;
  audience?: HandoffAudience;
  fileName?: string;
  blob?: Blob;
};

export type MeetingMinutesSharePointSaveResult = {
  fileName: string;
  serverRelativeUrl?: string;
  absoluteUrl?: string;
  itemId?: string;
  linkUrl?: string | null;
};

/**
 * useMeetingMinutesSharePointExport.tsx
 *
 * 責務:
 * - UIから簡単にSharePoint保存を呼び出せるインターフェースを提供する。
 * - 独自の Blob が渡されなかった場合は、Option A として
 *   「Print Preview の HTML を Blob 化して保存する」フォールバック挙動を持つ。
 */
export function useMeetingMinutesSharePointExport() {
  const spClient = useSP();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedFile, setLastSavedFile] = useState<MeetingMinutesSharePointSaveResult | null>(null);

  const clearLastSavedFile = useCallback(() => setLastSavedFile(null), []);

  const saveToSharePoint = useCallback(async (params: SharePointExportParams): Promise<UploadResult | null> => {
    setIsSaving(true);
    setError(null);
    setLastSavedFile(null);

    const { model, audience, fileName } = params;
    let { blob } = params;
    let contentType = 'application/pdf';

    const generatedFileName = fileName || buildMeetingMinutesPdfFileName({
      title: model.title,
      meetingDate: model.meetingDate,
      audience,
    });

    try {
      if (!blob) {
        // Blob が必須ではない Option A 実装: HTML出力
        const htmlString = renderToString(
          <MeetingMinutesPrintPreview model={model} audience={audience} />
        );
        // HTMLドキュメントとしてラップ
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${model.title}</title>
</head>
<body>
${htmlString}
</body>
</html>`;
        blob = new Blob([fullHtml], { type: 'text/html' });
        // HTMLとして保存するので拡張子を .html にする
        const finalFileName = generatedFileName.replace(/\.pdf$/, '.html');
        contentType = 'text/html';

        const result = await uploadMeetingMinutesExport({
          spClient,
          fileName: finalFileName,
          blob,
          contentType,
          audience,
        });
        
        const linkUrl = buildMeetingMinutesSharePointLink({
          serverRelativeUrl: result.fileUrl,
        });

        setLastSavedFile({
          fileName: result.fileName,
          serverRelativeUrl: result.fileUrl,
          linkUrl,
        });

        return result;
      } else {
        const result = await uploadMeetingMinutesExport({
          spClient,
          fileName: generatedFileName,
          blob,
          contentType,
          audience,
        });

        const linkUrl = buildMeetingMinutesSharePointLink({
          serverRelativeUrl: result.fileUrl,
        });

        setLastSavedFile({
          fileName: result.fileName,
          serverRelativeUrl: result.fileUrl,
          linkUrl,
        });

        return result;
      }
    } catch (err) {
      console.error('Failed to upload meeting minutes:', err);
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました。');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [spClient]);

  return { saveToSharePoint, isSaving, error, lastSavedFile, clearLastSavedFile };
}
