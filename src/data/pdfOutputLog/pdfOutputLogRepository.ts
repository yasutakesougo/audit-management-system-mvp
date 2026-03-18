/**
 * PdfOutput_Log Repository — 帳票出力の監査証跡を記録
 *
 * 帳票（PDF/Excel）の出力時にこのリポジトリを呼び出し、
 * 「誰が・いつ・何を出力したか」を SharePoint リストに記録する。
 *
 * 実地指導での帳票出力追跡に使用。
 *
 * @see src/sharepoint/fields/pdfOutputLogFields.ts
 */
import type { UseSP } from '@/lib/spClient';
import {
  PDF_OUTPUT_LOG_FIELDS,
  PDF_OUTPUT_LOG_LIST_TITLE,
  PDF_OUTPUT_LOG_SELECT_FIELDS,
  buildPdfOutputLogTitle,
} from '@/sharepoint/fields/pdfOutputLogFields';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type PdfOutputType =
  | 'monthly-report'
  | 'service-provision'
  | 'isp'
  | 'billing'
  | 'attendance';

export type PdfOutputStatus = 'success' | 'failed' | 'pending';
export type PdfOutputSource = 'power-automate' | 'manual' | 'scheduled';

export interface PdfOutputLogEntry {
  id?: number;
  outputType: PdfOutputType;
  userCode: string;
  outputDate: string;      // ISO date
  targetPeriod: string;    // 'YYYY-MM' format
  fileName: string;
  fileUrl?: string;
  outputBy: string;        // UPN or StaffId
  status: PdfOutputStatus;
  errorMessage?: string;
  source: PdfOutputSource;
  created?: string;
  modified?: string;
}

export interface PdfOutputLogCreateInput {
  outputType: PdfOutputType;
  userCode: string;
  targetPeriod: string;
  fileName: string;
  fileUrl?: string;
  outputBy: string;
  status: PdfOutputStatus;
  errorMessage?: string;
  source: PdfOutputSource;
}

export interface PdfOutputLogRepository {
  /** 出力ログを記録する */
  log(input: PdfOutputLogCreateInput): Promise<number>;
  /** 対象期間の出力ログを取得する */
  getByPeriod(targetPeriod: string): Promise<PdfOutputLogEntry[]>;
  /** 利用者コードで出力ログを取得する */
  getByUser(userCode: string, top?: number): Promise<PdfOutputLogEntry[]>;
}

// ────────────────────────────────────────────────────────────────
// SP Row Types
// ────────────────────────────────────────────────────────────────

interface SpPdfOutputLogRow {
  Id: number;
  Title: string;
  OutputType: string;
  UserCode: string;
  OutputDate: string;
  TargetPeriod: string;
  FileName: string;
  FileUrl?: string | null;
  OutputBy: string;
  Status: string;
  ErrorMessage?: string | null;
  Source: string;
  Created: string;
  Modified: string;
}

/** SharePoint 作成系レスポンス型（addListItemByTitle の返却値） */
type SpLogCreatedItem = {
  Id?: number;
  d?: { Id?: number };
  data?: { Id?: number };
} & Record<string, unknown>;

// ────────────────────────────────────────────────────────────────
// Mapper
// ────────────────────────────────────────────────────────────────

function mapRowToEntry(row: SpPdfOutputLogRow): PdfOutputLogEntry {
  return {
    id: row.Id,
    outputType: row.OutputType as PdfOutputType,
    userCode: row.UserCode,
    outputDate: row.OutputDate,
    targetPeriod: row.TargetPeriod,
    fileName: row.FileName,
    fileUrl: row.FileUrl ?? undefined,
    outputBy: row.OutputBy,
    status: row.Status as PdfOutputStatus,
    errorMessage: row.ErrorMessage ?? undefined,
    source: row.Source as PdfOutputSource,
    created: row.Created,
    modified: row.Modified,
  };
}

// ────────────────────────────────────────────────────────────────
// Repository Implementation
// ────────────────────────────────────────────────────────────────

const SELECT = [...PDF_OUTPUT_LOG_SELECT_FIELDS] as string[];

export function createPdfOutputLogRepository(sp: UseSP): PdfOutputLogRepository {
  return {
    async log(input: PdfOutputLogCreateInput): Promise<number> {
      const now = new Date().toISOString();
      const title = buildPdfOutputLogTitle(input.outputType, input.userCode, input.targetPeriod);

      const payload: Record<string, unknown> = {
        [PDF_OUTPUT_LOG_FIELDS.title]: title,
        [PDF_OUTPUT_LOG_FIELDS.outputType]: input.outputType,
        [PDF_OUTPUT_LOG_FIELDS.userCode]: input.userCode,
        [PDF_OUTPUT_LOG_FIELDS.outputDate]: now,
        [PDF_OUTPUT_LOG_FIELDS.targetPeriod]: input.targetPeriod,
        [PDF_OUTPUT_LOG_FIELDS.fileName]: input.fileName,
        [PDF_OUTPUT_LOG_FIELDS.outputBy]: input.outputBy,
        [PDF_OUTPUT_LOG_FIELDS.status]: input.status,
        [PDF_OUTPUT_LOG_FIELDS.source]: input.source,
      };

      if (input.fileUrl) {
        payload[PDF_OUTPUT_LOG_FIELDS.fileUrl] = input.fileUrl;
      }
      if (input.errorMessage) {
        payload[PDF_OUTPUT_LOG_FIELDS.errorMessage] = input.errorMessage;
      }

      const result = await sp.addListItemByTitle(PDF_OUTPUT_LOG_LIST_TITLE, payload) as SpLogCreatedItem;
      const createdId = Number(result?.Id ?? result?.d?.Id ?? result?.data?.Id ?? 0);

      console.info(`[PdfOutputLog] ✅ Logged: ${title} (ID: ${createdId})`);
      return createdId;
    },

    async getByPeriod(targetPeriod: string): Promise<PdfOutputLogEntry[]> {
      const rows = await sp.listItems<SpPdfOutputLogRow>(PDF_OUTPUT_LOG_LIST_TITLE, {
        select: SELECT,
        filter: `${PDF_OUTPUT_LOG_FIELDS.targetPeriod} eq '${targetPeriod}'`,
        orderby: `${PDF_OUTPUT_LOG_FIELDS.outputDate} desc`,
        top: 500,
      });

      return rows.map(mapRowToEntry);
    },

    async getByUser(userCode: string, top = 50): Promise<PdfOutputLogEntry[]> {
      const rows = await sp.listItems<SpPdfOutputLogRow>(PDF_OUTPUT_LOG_LIST_TITLE, {
        select: SELECT,
        filter: `${PDF_OUTPUT_LOG_FIELDS.userCode} eq '${userCode}'`,
        orderby: `${PDF_OUTPUT_LOG_FIELDS.outputDate} desc`,
        top,
      });

      return rows.map(mapRowToEntry);
    },
  };
}

/** @internal テスト用 */
export const __test__ = { mapRowToEntry };
