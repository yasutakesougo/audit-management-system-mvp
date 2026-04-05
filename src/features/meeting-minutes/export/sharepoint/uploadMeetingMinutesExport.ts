import type { UseSP } from '@/lib/spClient';
import type { HandoffAudience } from '../../editor/handoffTemplates';
import { MEETING_MINUTES_EXPORT_LIBRARY } from './meetingMinutesLibraryConfig';

export interface UploadResult {
  fileUrl: string;
  fileName: string;
}

/**
 * uploadMeetingMinutesExport.ts
 *
 * 責務:
 * - 議事録エクスポート成果物（HTML / PDF Blob）を SharePoint ライブラリにアップロードする
 * - APIエンドポイントの構築とフェッチ、およびエラー解釈を行う
 */
export async function uploadMeetingMinutesExport(input: {
  spClient: UseSP;
  fileName: string;
  blob: Blob;
  contentType: string;
  audience?: HandoffAudience;
  minutesId?: number;
}): Promise<UploadResult> {
  const { spClient, fileName, blob, contentType } = input;

  const encodedFileName = encodeURIComponent(fileName);

  // ライブラリのルートフォルダへアップロードする。
  // 将来的には baseFolderPath や audience ディレクトリを作る構成へ拡張可能
  const path = `/_api/web/lists/getbytitle('${MEETING_MINUTES_EXPORT_LIBRARY.libraryTitle}')/RootFolder/Files/add(url='${encodedFileName}',overwrite=true)`;

  const res = await spClient.spFetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
    },
    // fetch API に Blob を渡せば自動的にバイナリ送信される
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let errorMessage = '不明なエラー';
    if (res.status === 404) {
      errorMessage = '指定された文書ライブラリが見つかりません。';
    } else if (res.status === 403) {
      errorMessage = 'アップロード権限がありません。';
    }

    throw new Error(
      `SharePoint upload failed (${res.status}): ${res.statusText}. ${errorMessage}. ${text.substring(0, 100)}`
    );
  }

  const json = await res.json().catch(() => ({}));
  const serverRelativeUrl = json.d?.ServerRelativeUrl ?? json.ServerRelativeUrl ?? '';

  return {
    fileUrl: serverRelativeUrl,
    fileName,
  };
}
