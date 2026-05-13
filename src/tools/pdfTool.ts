import * as fs from 'fs';
import { AgentState } from '../state/AgentState';

interface Token {
  x: number;
  y: number;
  str: string;
}

function reconstructPage(items: Token[], pageWidth: number): string {
  if (items.length === 0) return '';

  const midX = pageWidth / 2;
  const leftItems: Token[] = [];
  const rightItems: Token[] = [];
  for (const it of items) {
    (it.x < midX ? leftItems : rightItems).push(it);
  }

  const hasTwoColumns = leftItems.length > 5 && rightItems.length > 5;
  const groups = hasTwoColumns ? [leftItems, rightItems] : [items];

  const lines: string[] = [];
  for (const group of groups) {
    const rows = new Map<number, Token[]>();
    for (const it of group) {
      const y = Math.round(it.y);
      const arr = rows.get(y) ?? [];
      arr.push(it);
      rows.set(y, arr);
    }
    const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of sortedY) {
      const line = rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((it) => it.str)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) lines.push(line);
    }
  }
  return lines.join('\n');
}

export async function pdfTool(state: AgentState): Promise<string[]> {
  state.addLog(`pdfTool: 시작 - ${state.pdfPath}`);

  if (!fs.existsSync(state.pdfPath)) {
    throw new Error(`PDF 파일을 찾을 수 없습니다: ${state.pdfPath}`);
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(state.pdfPath));

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  state.totalPages = doc.numPages;
  state.addLog(`pdfTool: 총 페이지 수 = ${doc.numPages}`);

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const tokens: Token[] = [];
    for (const item of content.items as any[]) {
      if (!('str' in item) || !item.str) continue;
      const tr = item.transform as number[];
      tokens.push({ x: tr[4], y: tr[5], str: item.str });
    }

    pages.push(reconstructPage(tokens, viewport.width));
  }

  await doc.destroy();
  state.addLog(`pdfTool: 완료 (${pages.length}페이지 추출)`);
  return pages;
}
