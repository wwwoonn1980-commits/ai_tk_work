import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { AgentState } from '../state/AgentState';

const SHEET_NAME = '요구사항정의서(MIS)';
const HEADER_ROW = 1;
const DATA_START_ROW = 2;

const COL = {
  SEQ: 1,         // 일련번호
  RFP_ID: 4,      // 요구사항 고유번호(RFP)
  SOURCE: 6,      // 출처
  RFP_NAME: 7,    // 요구사항 명칭(RFP)
  DEF_ID: 8,      // 요구사항정의ID
  DEF_NAME: 9,    // 요구사항정의명
  DEF_DETAIL: 10, // 요구사항정의 내용
} as const;

function extractRfpId(subId: string): string {
  const m = subId.match(/^(.+)-\d{3}$/);
  return m ? m[1] : subId;
}

function deriveDefName(detail: string): string {
  if (!detail) return '';
  const firstLine = detail.split('\n')[0].trim();
  return firstLine.replace(/^[·\-○•]\s*/, '').slice(0, 60);
}

function defNameOf(req: { definitionName?: string; detail: string }): string {
  if (req.definitionName) return req.definitionName;
  return deriveDefName(req.detail);
}

export async function excelTool(state: AgentState): Promise<number> {
  state.addLog(`excelTool: 시작 - template=${state.templatePath}`);

  if (!fs.existsSync(state.templatePath)) {
    throw new Error(`템플릿 파일을 찾을 수 없습니다: ${state.templatePath}`);
  }

  const requirements = state.getRequirementsList();
  if (requirements.length === 0) {
    throw new Error('저장할 요구사항이 없습니다.');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(state.templatePath);

  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) {
    throw new Error('템플릿 워크시트를 찾을 수 없습니다.');
  }
  state.addLog(`excelTool: 시트 "${ws.name}" 사용 (헤더 행 ${HEADER_ROW})`);

  const refRow = ws.getRow(DATA_START_ROW);

  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    const rowIdx = DATA_START_ROW + i;
    const row = ws.getRow(rowIdx);

    if (rowIdx > DATA_START_ROW) {
      for (let c = 1; c <= ws.columnCount; c++) {
        const src = refRow.getCell(c);
        const dst = row.getCell(c);
        if (src.style) dst.style = JSON.parse(JSON.stringify(src.style));
      }
    }

    row.getCell(COL.SEQ).value = i + 1;
    row.getCell(COL.RFP_ID).value = extractRfpId(req.id);
    row.getCell(COL.SOURCE).value = '제안요청서';
    row.getCell(COL.RFP_NAME).value = req.name ?? '';
    row.getCell(COL.DEF_ID).value = req.id;
    row.getCell(COL.DEF_NAME).value = defNameOf(req);
    row.getCell(COL.DEF_DETAIL).value = req.detail ?? '';
    row.commit();
  }

  fs.mkdirSync(path.dirname(state.outputPath), { recursive: true });
  await wb.xlsx.writeFile(state.outputPath);

  await sanitizeVmlInsets(state.outputPath);

  state.addLog(`excelTool: 완료 - ${requirements.length}행 저장 → ${state.outputPath}`);
  return requirements.length;
}

async function sanitizeVmlInsets(filePath: string): Promise<void> {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;
  for (const name of Object.keys(zip.files)) {
    if (!/\.vml$/i.test(name)) continue;
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    if (!/inset="[^"]*NaN[^"]*"/.test(xml)) continue;
    const fixed = xml.replace(/\s*inset="[^"]*NaN[^"]*"/g, '');
    zip.file(name, fixed);
    changed = true;
  }
  if (!changed) return;
  const out = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(filePath, out);
}
