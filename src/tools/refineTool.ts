import { AgentState } from '../state/AgentState';
import { Requirement } from '../types';
import {
  ContextAdvisor,
  ContextCandidate,
  createContextAdvisor,
} from '../llm/contextAdvisor';

const BULLET_CHARS = ['○', '·', '•', '-'] as const;
type BulletChar = (typeof BULLET_CHARS)[number];

interface LineInfo {
  raw: string;
  indent: number;
  bullet: BulletChar | null;
}

function classifyLine(raw: string): LineInfo {
  const trimmedLeft = raw.replace(/^\s+/, '');
  const indent = raw.length - trimmedLeft.length;
  const first = trimmedLeft.charAt(0) as BulletChar | '';
  let bullet: BulletChar | null = null;
  if (first === '-') {
    if (/^-\s/.test(trimmedLeft)) bullet = '-';
  } else if (BULLET_CHARS.includes(first as BulletChar)) {
    bullet = first as BulletChar;
  }
  return { raw, indent, bullet };
}

function splitDetail(detail: string): string[] {
  if (!detail) return [];
  const lines = detail.split('\n').map(classifyLine);
  const bulletLines = lines.filter((l) => l.bullet !== null);
  if (bulletLines.length === 0) return [detail.trim()];

  const minIndent = Math.min(...bulletLines.map((l) => l.indent));
  const topChar = bulletLines.find((l) => l.indent === minIndent)!.bullet!;

  const items: string[] = [];
  let current: string[] = [];
  let firstTopSeen = false;
  const flush = () => {
    const joined = current.join('\n').trim();
    if (joined) items.push(joined);
    current = [];
  };
  for (const line of lines) {
    const isTopItem = line.bullet === topChar && line.indent === minIndent;
    if (isTopItem) {
      if (firstTopSeen) flush();
      current.push(line.raw);
      firstTopSeen = true;
    } else {
      current.push(line.raw);
    }
  }
  flush();
  return items;
}

function padIndex(n: number): string {
  return n.toString().padStart(3, '0');
}

export async function refineTool(
  state: AgentState,
  advisor: ContextAdvisor = createContextAdvisor(state.splitMode)
): Promise<void> {
  state.addLog(`refineTool: 시작 (splitMode=${state.splitMode})`);

  const originals = state.getRequirementsList();

  const candidatesById = new Map<string, { req: Requirement; items: string[] }>();
  for (const req of originals) {
    const items = splitDetail(req.detail);
    if (items.length > 1) {
      candidatesById.set(req.id, { req, items });
    }
  }

  state.addLog(
    `refineTool: 분리 후보 ${candidatesById.size}건 식별, LLM 문맥 판단 호출`
  );

  let verdicts: Map<string, boolean[]>;
  try {
    const candidatePayload: ContextCandidate[] = Array.from(candidatesById.entries()).map(
      ([id, { items }]) => ({ id, items })
    );
    verdicts = await advisor.judge(candidatePayload);
  } catch (err) {
    state.addLog(`refineTool: advisor 호출 실패 - ${(err as Error).message}. merge 폴백`);
    verdicts = new Map();
    for (const [id, { items }] of candidatesById) {
      verdicts.set(
        id,
        items.map(() => true)
      );
    }
  }

  const refined: Map<string, Requirement> = new Map();
  let splitCount = 0;

  for (const req of originals) {
    const candidate = candidatesById.get(req.id);

    if (!candidate) {
      const subId = `${req.id}-${padIndex(1)}`;
      refined.set(subId, { ...req, id: subId });
      continue;
    }

    const matches = verdicts.get(req.id) ?? candidate.items.map(() => true);
    const groupOne: string[] = [];
    const others: string[] = [];

    for (let i = 0; i < candidate.items.length; i++) {
      const isMatch = i === 0 ? true : matches[i] === true;
      if (isMatch) groupOne.push(candidate.items[i]);
      else others.push(candidate.items[i]);
    }

    const baseId = `${req.id}-${padIndex(1)}`;
    refined.set(baseId, {
      ...req,
      id: baseId,
      detail: groupOne.join('\n'),
    });

    others.forEach((item, idx) => {
      const subId = `${req.id}-${padIndex(idx + 2)}`;
      refined.set(subId, { ...req, id: subId, detail: item });
    });

    if (others.length > 0) splitCount += 1;
  }

  state.requirements = refined;
  state.addLog(
    `refineTool: 완료 (분리 발생 ${splitCount}건, 최종 ${refined.size}건)`
  );
}

export const __test = { splitDetail, padIndex, classifyLine };
