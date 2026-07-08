import ExcelJS from 'exceljs';

/**
 * Basic interface for Excel export data
 */
export interface ExcelExportOptions {
  fileName: string;
  sheetName?: string;
}

function addRowsFromObjects(worksheet: ExcelJS.Worksheet, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);
  worksheet.addRow(headers);
  rows.forEach((row) => {
    worksheet.addRow(headers.map((header) => row[header] ?? ''));
  });
}

/**
 * Utility to export an array of objects to an Excel file
 */
export async function exportToExcel<T>(
  data: T[],
  options: ExcelExportOptions
): Promise<void> {
  const { fileName, sheetName = 'Sheet1' } = options;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  addRowsFromObjects(worksheet, data as Record<string, unknown>[]);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Utility for more complex multi-sheet exports
 */
export function exportMultiSheet(
  sheets: Record<string, unknown[]>,
  fileName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  Object.entries(sheets).forEach(([sheetName, data]) => {
    const worksheet = workbook.addWorksheet(sheetName);
    addRowsFromObjects(worksheet, data as Record<string, unknown>[]);
  });

  const download = async () => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return download();
}
