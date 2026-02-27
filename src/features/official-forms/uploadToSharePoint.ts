/**
 * SharePoint ドキュメントライブラリへのファイルアップロード
 *
 * SP REST API: /_api/web/GetFolderByServerRelativeUrl('/path')/Files/add(url='filename',overwrite=true)
 */
import type { UseSP } from '@/lib/spClient';

const LIBRARY_NAME = 'OfficialForms';

export interface UploadResult {
  /** SharePoint上のファイルURL */
  fileUrl: string;
  /** ファイル名 */
  fileName: string;
}

/**
 * xlsx バイトを SharePoint ドキュメントライブラリにアップロード
 *
 * @param sp - useSP() が返す SP client
 * @param fileName - アップロードファイル名
 * @param bytes - ファイル内容 (ArrayBuffer)
 * @returns アップロード結果
 */
export async function uploadToSharePointLibrary(
  sp: UseSP,
  fileName: string,
  bytes: ArrayBuffer,
): Promise<UploadResult> {
  const encodedFileName = encodeURIComponent(fileName);
  const path = `/lists/getbytitle('${LIBRARY_NAME}')/RootFolder/Files/add(url='${encodedFileName}',overwrite=true)`;

  const res = await sp.spFetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: bytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `SharePoint upload failed: ${res.status} ${res.statusText}. ${text.substring(0, 200)}`
    );
  }

  const json = await res.json().catch(() => ({}));
  const serverRelativeUrl = json.d?.ServerRelativeUrl ?? json.ServerRelativeUrl ?? '';

  return {
    fileUrl: serverRelativeUrl,
    fileName,
  };
}
