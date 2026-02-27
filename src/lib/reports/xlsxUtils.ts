import * as XLSX from 'xlsx';

/**
 * Basic interface for Excel export data
 */
export interface ExcelExportOptions {
  fileName: string;
  sheetName?: string;
}

/**
 * Utility to export an array of objects to an Excel file
 */
export function exportToExcel<T>(
  data: T[],
  options: ExcelExportOptions
): void {
  const { fileName, sheetName = 'Sheet1' } = options;

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger download
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Utility for more complex multi-sheet exports
 */
export function exportMultiSheet(
  sheets: Record<string, unknown[]>,
  fileName: string
): void {
  const workbook = XLSX.utils.book_new();

  Object.entries(sheets).forEach(([sheetName, data]) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
