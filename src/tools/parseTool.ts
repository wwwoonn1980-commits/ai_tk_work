import { AgentState } from '../state/AgentState';
import { Requirement } from '../types';
import { createEnricher } from '../llm/claudeClient';

const ID_PATTERN = /(FUR|NFR|PER|SIR|DAR|TER|SER|COR|QUR|TSR|ECR|PMR|PSR|UR)-\d{2,4}/;
const HEADER_PATTERN = /요구사항\s*고유번호\s*((FUR|NFR|PER|SIR|DAR|TER|SER|COR|QUR|TSR|ECR|PMR|PSR|UR)-\d{2,4})/;

const NOISE_PATTERNS: RegExp[] = [
  /^요구사항$/,
  /^상세설명$/,
  /^세부내용$/,
  /^상세설명세부내용$/,
  /^정의$/,
  /^산출\s*정보$/,
  /^관련\s*요구사항$/,
  /^-\s*\d+\s*-$/,
];

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

const FIELD_MAP: Array<{ key: keyof Requirement; label: RegExp }> = [
  { key: 'category', label: /^요구사항\s*분류\s*(.*)$/ },
  { key: 'type', label: /^요구사항\s*유형\s*(.*)$/ },
  { key: 'name', label: /^요구사항\s*명칭\s*(.*)$/ },
];

function splitIntoBlocks(
  pages: string[],
  onPageEnter?: (pageNumber: number) => void
): Array<{ id: string; lines: string[]; page: number }> {
  const blocks: Array<{ id: string; lines: string[]; page: number }> = [];
  let current: { id: string; lines: string[]; page: number } | null = null;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    onPageEnter?.(pageIdx + 1);
    const lines = pages[pageIdx].split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const headerMatch = line.match(HEADER_PATTERN);
      if (headerMatch) {
        if (current) blocks.push(current);
        current = { id: headerMatch[1], lines: [], page: pageIdx + 1 };
        const rest = line.replace(HEADER_PATTERN, '').trim();
        if (rest) current.lines.push(rest);
        continue;
      }
      if (current) current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function blockToRequirement(block: { id: string; lines: string[]; page: number }): Requirement {
  const req: Requirement = { id: block.id, detail: '', source: { page: block.page } };
  const detailLines: string[] = [];
  let section: 'detail' | null = null;

  for (const line of block.lines) {
    let consumed = false;
    for (const { key, label } of FIELD_MAP) {
      const m = line.match(label);
      if (m) {
        (req as any)[key] = m[1].trim();
        consumed = true;
        section = null;
        break;
      }
    }
    if (consumed) continue;

    if (/^정의\s+/.test(line) || /^정의$/.test(line)) {
      // 정의는 단일 행 형식('정의 [내용]')으로 가정.
      // 해당 라인의 내용은 요구사항정의명(definitionName)으로 보존하고,
      // 이후 라인은 detail 자동 진입 대상으로 둔다.
      const defText = line.replace(/^정의\s*/, '').trim();
      if (defText && !req.definitionName) req.definitionName = defText;
      section = null;
      continue;
    }
    if (/^요구사항\s*상세설명/.test(line) || /^세부내용/.test(line) || /^상세설명세부내용/.test(line)) {
      section = 'detail';
      const stripped = line
        .replace(/^요구사항\s*상세설명/, '')
        .replace(/^상세설명세부내용/, '')
        .replace(/^세부내용/, '')
        .trim();
      if (stripped) detailLines.push(stripped);
      continue;
    }
    if (/^산출\s*정보/.test(line) || /^관련\s*요구사항/.test(line)) {
      section = null;
      continue;
    }
    if (isNoiseLine(line)) continue;
    if (section === 'detail' || /^[·\-○•]/.test(line)) {
      detailLines.push(line);
      section = 'detail';
    }
  }

  req.detail = detailLines.join('\n').trim();
  return req;
}

export async function parseTool(state: AgentState, pages: string[]): Promise<void> {
  state.addLog(`parseTool: 시작 (includeAll=${state.includeAll})`);

  const blocks = splitIntoBlocks(pages, (pageNumber) => {
    state.currentPage = pageNumber;
  });
  state.addLog(`parseTool: 헤더 기반 블록 ${blocks.length}개 식별`);

  for (const block of blocks) {
    const req = blockToRequirement(block);
    if (state.includeAll || req.detail) {
      state.addRequirement(req);
    }
  }

  const enricher = createEnricher();
  const enriched = await enricher.enrich(pages, state.getRequirementsList());
  for (const r of enriched) {
    state.addRequirement(r);
  }

  state.addLog(`parseTool: 완료 (요구사항 ${state.getRequirementsList().length}건)`);
}

export const __test = { splitIntoBlocks, blockToRequirement, ID_PATTERN };
