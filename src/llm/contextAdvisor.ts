import { SplitMode } from '../types';

export interface ContextCandidate {
  id: string;
  items: string[];
}

export interface ContextAdvisor {
  judge(candidates: ContextCandidate[]): Promise<Map<string, boolean[]>>;
}

/** 모든 후속 항목을 일치(true) 처리 → 단일 `-001`로 병합 (디폴트). */
export class MergeAllAdvisor implements ContextAdvisor {
  async judge(candidates: ContextCandidate[]): Promise<Map<string, boolean[]>> {
    const result = new Map<string, boolean[]>();
    for (const c of candidates) {
      result.set(c.id, c.items.map(() => true));
    }
    return result;
  }
}

/** 모든 후속 항목을 불일치(false) 처리 → 각 항목 독립 정의ID. */
export class SplitAllAdvisor implements ContextAdvisor {
  async judge(candidates: ContextCandidate[]): Promise<Map<string, boolean[]>> {
    const result = new Map<string, boolean[]>();
    for (const c of candidates) {
      result.set(
        c.id,
        c.items.map((_, i) => i === 0)
      );
    }
    return result;
  }
}

const STOPWORDS = new Set([
  '기능',
  '관리',
  '시스템',
  '정보',
  '내용',
  '대한',
  '위한',
  '관련',
  '있는',
  '있도록',
  '가능',
  '제공',
  '사용',
  '구현',
  '처리',
  '수행',
  '및',
  '등',
]);

function tokenize(text: string): Set<string> {
  const cleaned = text.replace(/^[·\-○•]\s*/, '').toLowerCase();
  const tokens = cleaned.match(/[가-힣]{2,}|[a-z]{3,}/g) ?? [];
  return new Set(tokens.filter((t) => !STOPWORDS.has(t)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

/**
 * 토큰 Jaccard 유사도 기반 컨텍스트 판단. API 호출 없음.
 * threshold (기본 0.2) 이상이면 첫 문맥과 일치로 본다.
 */
export class HeuristicContextAdvisor implements ContextAdvisor {
  constructor(private readonly threshold: number = 0.2) {}

  async judge(candidates: ContextCandidate[]): Promise<Map<string, boolean[]>> {
    const result = new Map<string, boolean[]>();
    for (const c of candidates) {
      const anchorTokens = tokenize(c.items[0]);
      const matches: boolean[] = [true];
      for (let i = 1; i < c.items.length; i++) {
        const sim = jaccard(anchorTokens, tokenize(c.items[i]));
        matches.push(sim >= this.threshold);
      }
      result.set(c.id, matches);
    }
    return result;
  }
}

const DEFAULT_MODEL = 'claude-haiku-4-5';
const BATCH_SIZE = 10;

export class ClaudeContextAdvisor implements ContextAdvisor {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async judge(candidates: ContextCandidate[]): Promise<Map<string, boolean[]>> {
    const result = new Map<string, boolean[]>();
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      try {
        const verdicts = await this.callBatch(batch);
        batch.forEach((c, idx) => {
          const v = verdicts[idx];
          if (v && v.length === c.items.length) {
            result.set(c.id, v);
          } else {
            result.set(c.id, c.items.map(() => true));
          }
        });
      } catch {
        for (const c of batch) result.set(c.id, c.items.map(() => true));
      }
    }
    return result;
  }

  private compact(s: string, max = 200): string {
    const t = s.replace(/[ \t]+/g, ' ').replace(/\n+/g, ' / ').trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
  }

  private buildPrompt(batch: ContextCandidate[]): string {
    const blocks = batch
      .map((c, i) => {
        const anchor = this.compact(c.items[0]);
        const others = c.items
          .slice(1)
          .map((s, k) => `  (${k + 2}) ${this.compact(s)}`)
          .join('\n');
        return `[후보 ${i + 1}] id=${c.id}\n기준(1): ${anchor}\n비교 항목:\n${others}`;
      })
      .join('\n\n');

    return [
      '당신은 RFP 요구사항 세부내용 분석가입니다.',
      '각 후보의 "기준(1)" 항목을 첫번째 문맥으로 두고, 비교 항목들이 기준과 같은 문맥(동일 메뉴/기능/주제)인지 판단해주세요.',
      '같은 문맥이면 true, 다른 문맥이면 false 입니다.',
      '',
      blocks,
      '',
      `각 후보별로 모든 항목(기준 포함, 길이 ${batch.map((c) => c.items.length).join('/')})에 대해 boolean 배열을 반환하세요.`,
      '첫번째(기준) 원소는 항상 true 입니다.',
      'JSON으로만 응답: {"results": [[true, true, false], [true, false, false, true]]}',
      '다른 텍스트는 포함하지 마세요.',
    ].join('\n');
  }

  private async callBatch(batch: ContextCandidate[]): Promise<boolean[][]> {
    const prompt = this.buildPrompt(batch);
    const res = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const raw = data.content?.[0]?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`unparseable response: ${raw.slice(0, 200)}`);
    const parsed = JSON.parse(match[0]) as { results?: unknown };
    const results = parsed.results;
    if (!Array.isArray(results) || results.length !== batch.length) {
      throw new Error(
        `results length mismatch: got ${Array.isArray(results) ? results.length : 'non-array'}, expected ${batch.length}`
      );
    }
    return results.map((row) => {
      if (!Array.isArray(row)) return [];
      return row.map((v, idx) => (idx === 0 ? true : v === true));
    });
  }
}

export function createContextAdvisor(mode: SplitMode = 'merge'): ContextAdvisor {
  switch (mode) {
    case 'split-all':
      return new SplitAllAdvisor();
    case 'heuristic':
      return new HeuristicContextAdvisor();
    case 'llm': {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) {
        console.warn('[contextAdvisor] ANTHROPIC_API_KEY 미설정 → merge 폴백');
        return new MergeAllAdvisor();
      }
      return new ClaudeContextAdvisor(key);
    }
    case 'merge':
    default:
      return new MergeAllAdvisor();
  }
}

export const __test = { tokenize, jaccard };
