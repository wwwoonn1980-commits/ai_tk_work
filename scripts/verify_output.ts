import * as fs from 'fs';
import ExcelJS from 'exceljs';

(async () => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('파일 경로를 인자로 넘기세요.');
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  console.log(`Sheet: ${ws.name}, rows=${ws.rowCount}`);
  console.log('Header row:', [
    ws.getCell(1, 1).value,
    ws.getCell(1, 4).value,
    ws.getCell(1, 7).value,
    ws.getCell(1, 8).value,
  ]);
  for (const r of [2, 3, 4, 5, 100, ws.rowCount]) {
    const row = ws.getRow(r);
    console.log(`r${r}:`, {
      seq: row.getCell(1).value,
      id: row.getCell(4).value,
      name: row.getCell(7).value,
      detail: String(row.getCell(8).value ?? '').slice(0, 80),
    });
  }
})();
