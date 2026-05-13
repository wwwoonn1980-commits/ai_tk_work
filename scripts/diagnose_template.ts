import ExcelJS from 'exceljs';

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('resource/sample/25KTD(N)_10_RA32_요구사항정의서_sample.xlsx');

  console.log('=== Workbook ===');
  console.log('definedNames:', JSON.stringify((wb as any).definedNames?.matrixMap ?? {}, null, 2));

  for (const ws of wb.worksheets) {
    console.log(`\n=== Sheet: ${ws.name} ===`);
    console.log('rowCount:', ws.rowCount, 'colCount:', ws.columnCount);
    console.log('autoFilter:', JSON.stringify(ws.autoFilter));
    console.log('mergedCells:', JSON.stringify((ws as any)._merges ?? {}));
    console.log('dataValidations:', JSON.stringify((ws as any).dataValidations?.model ?? {}));
    console.log('conditionalFormattings:', JSON.stringify((ws as any).conditionalFormattings ?? []));
    console.log('views:', JSON.stringify(ws.views));
    console.log('pageSetup:', JSON.stringify(ws.pageSetup));

    console.log('\n-- row 2 cells --');
    const row = ws.getRow(2);
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      console.log(`  c${c}: addr=${cell.address} master=${cell.master?.address ?? '-'} type=${cell.type} value=${JSON.stringify(cell.value)}`);
    }
  }
})();
