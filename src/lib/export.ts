import * as XLSX from 'xlsx';

export function generateCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const csvLines: string[] = [];

  // Header row
  csvLines.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  // Data rows
  for (const row of rows) {
    const values = headers.map((header) => {
      const val = row[header] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvLines.join(',');
    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

export function generateExcelBuffer(rows: Record<string, any>[], sheetName = 'Report'): Uint8Array {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return new Uint8Array(excelBuffer);
}
