/**
 * CSV ダウンロードヘルパー
 *
 * Blob → Object URL → 仮想 <a> クリック → URL revoke
 *
 * encoding オプション:
 *  - 'utf8'（デフォルト）: BOM付きUTF-8（Excel互換）
 *  - 'sjis': Shift_JIS（国保連提出用、BOMなし）
 */
import { encodeToSjis } from './encoding';

export interface DownloadCsvOptions {
  /** エンコーディング（デフォルト: 'sjis'） */
  encoding?: 'utf8' | 'sjis';
}

/**
 * CSV文字列をファイルとしてダウンロード
 *
 * @param csv - CSV文字列（UTF-8）
 * @param filename - ファイル名（例: KOKU_71_202602.csv）
 * @param options - ダウンロードオプション
 */
export function downloadCsv(
  csv: string,
  filename: string,
  options: DownloadCsvOptions = {},
): void {
  const encoding = options.encoding ?? 'sjis'; // 国保連デフォルトはSJIS

  let blob: Blob;

  if (encoding === 'sjis') {
    // Shift_JIS — BOMなし
    const sjisBytes = encodeToSjis(csv);
    blob = new Blob([sjisBytes.buffer as ArrayBuffer], { type: 'text/csv;charset=shift_jis' });
  } else {
    // UTF-8 — BOM付き（Excel互換）
    const bom = '\uFEFF';
    blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  }

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
