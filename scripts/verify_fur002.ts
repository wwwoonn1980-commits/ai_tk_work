import * as fs from 'fs';
import ExcelJS from 'exceljs';

(async () => {
  const file = process.argv[2];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = String(ws.getRow(r).getCell(4).value ?? '');
    if (id.startsWith('FUR-002')) {
      console.log(`r${r} ${id}:`, String(ws.getRow(r).getCell(8).value ?? '').replace(/\n/g, ' | '));
    }
  }
})();
