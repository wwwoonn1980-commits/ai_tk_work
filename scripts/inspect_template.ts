import ExcelJS from 'exceljs';

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('resource/sample/25KTD(N)_10_RA32_요구사항정의서_sample.xlsx');
  for (const ws of wb.worksheets) {
    console.log(`\n=== Sheet: ${ws.name} (rows=${ws.rowCount}, cols=${ws.columnCount}) ===`);

    console.log('\n[Header row 1 - full text per column]');
    const headerRow = ws.getRow(1);
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = headerRow.getCell(c).value;
      const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      console.log(`  col ${c}: ${JSON.stringify(s)}`);
    }

    console.log('\n[Merged cell ranges]');
    const merges = (ws as any)._merges;
    if (merges) {
      for (const key of Object.keys(merges)) {
        console.log(`  ${key}`);
      }
    }

    console.log('\n[All non-empty rows 1..30]');
    for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
      const row = ws.getRow(r);
      let hasAny = false;
      const cells: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const v = row.getCell(c).value;
        const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
        if (s) hasAny = true;
        cells.push(s.replace(/\n/g, ' / ').slice(0, 30));
      }
      if (hasAny) console.log(`  r${r}:`, cells);
    }

    console.log('\n[Column widths]');
    for (let c = 1; c <= ws.columnCount; c++) {
      const col = ws.getColumn(c);
      console.log(`  col ${c}: width=${col.width}`);
    }
  }
})();
