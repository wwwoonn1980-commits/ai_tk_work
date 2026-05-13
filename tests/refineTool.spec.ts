import { describe, it, expect, vi } from 'vitest';
import { AgentState } from '../src/state/AgentState';
import { refineTool, __test } from '../src/tools/refineTool';
import { ContextAdvisor, ContextCandidate } from '../src/llm/contextAdvisor';

vi.spyOn(console, 'log').mockImplementation(() => undefined);

// 모든 후속 항목을 "불일치"로 판정 → 각 항목이 자신만의 새 정의ID로 분리
const alwaysSplit: ContextAdvisor = {
  async judge(candidates: ContextCandidate[]) {
    const m = new Map<string, boolean[]>();
    for (const c of candidates) {
      m.set(
        c.id,
        c.items.map((_, i) => i === 0)
      );
    }
    return m;
  },
};

// 모든 후속 항목을 "일치"로 판정 → 모두 -001 그룹으로 병합
const alwaysKeep: ContextAdvisor = {
  async judge(candidates: ContextCandidate[]) {
    const m = new Map<string, boolean[]>();
    for (const c of candidates) {
      m.set(
        c.id,
        c.items.map(() => true)
      );
    }
    return m;
  },
};

describe('refineTool.splitDetail', () => {
  it('○ 기호 기준으로 항목을 분리한다', () => {
    const parts = __test.splitDetail('○ 첫번째\n○ 두번째\n○ 세번째');
    expect(parts).toHaveLength(3);
  });

  it('· 와 - 가 섞여 있으면 상위(·)만 분리하고 -는 하위로 묶는다', () => {
    const parts = __test.splitDetail('·항목1\n- 하위1\n- 하위2\n·항목2\n- 하위3');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('·항목1');
    expect(parts[0]).toContain('- 하위1');
    expect(parts[0]).toContain('- 하위2');
    expect(parts[1]).toContain('·항목2');
    expect(parts[1]).toContain('- 하위3');
  });

  it('- 만 있을 때는 -를 상위로 보고 분리한다', () => {
    const parts = __test.splitDetail('- 항목1\n- 항목2\n- 항목3');
    expect(parts).toHaveLength(3);
  });

  it('단일 항목이면 그대로 1건만 반환한다', () => {
    const parts = __test.splitDetail('단일 설명만 있음');
    expect(parts).toHaveLength(1);
  });

  it('빈 detail은 빈 배열을 반환한다', () => {
    expect(__test.splitDetail('')).toEqual([]);
  });
});

describe('refineTool.padIndex', () => {
  it('1자리 → 001로 0 패딩한다', () => {
    expect(__test.padIndex(1)).toBe('001');
    expect(__test.padIndex(42)).toBe('042');
    expect(__test.padIndex(123)).toBe('123');
  });
});

describe('refineTool 통합', () => {
  it('여러 항목 detail을 -001, -002 ... 서브 ID로 분리한다', async () => {
    const state = new AgentState({
      pdfPath: '',
      templatePath: '',
      outputPath: '',
    });
    state.addRequirement({
      id: 'FUR-001',
      name: '프레임워크',
      category: '기능',
      detail: '·항목 A\n·항목 B\n·항목 C',
    });
    state.addRequirement({
      id: 'FUR-002',
      name: '단일',
      detail: '단일 설명',
    });

    await refineTool(state, alwaysSplit);
    const result = state.getRequirementsList();
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(['FUR-001-001', 'FUR-001-002', 'FUR-001-003', 'FUR-002-001']);

    const first = result.find((r) => r.id === 'FUR-001-001')!;
    expect(first.name).toBe('프레임워크');
    expect(first.category).toBe('기능');
    expect(first.detail).toBe('·항목 A');

    const single = result.find((r) => r.id === 'FUR-002-001')!;
    expect(single.name).toBe('단일');
  });

  it('하위 항목(-)은 상위 항목(·)에 묶여 함께 보존된다', async () => {
    const state = new AgentState({
      pdfPath: '',
      templatePath: '',
      outputPath: '',
    });
    state.addRequirement({
      id: 'FUR-100',
      detail: '·상위1\n- 하위1a\n- 하위1b\n·상위2\n- 하위2a',
    });

    await refineTool(state, alwaysSplit);
    const result = state.getRequirementsList();
    expect(result.map((r) => r.id).sort()).toEqual(['FUR-100-001', 'FUR-100-002']);

    const sub1 = result.find((r) => r.id === 'FUR-100-001')!;
    expect(sub1.detail).toContain('·상위1');
    expect(sub1.detail).toContain('- 하위1a');
    expect(sub1.detail).toContain('- 하위1b');
  });

  it('LLM이 모두 일치(merge)로 판정하면 단일 -001로 병합된다', async () => {
    const state = new AgentState({
      pdfPath: '',
      templatePath: '',
      outputPath: '',
    });
    state.addRequirement({
      id: 'FUR-300',
      detail: '·항목 A\n·항목 B',
    });

    await refineTool(state, alwaysKeep);
    const ids = state.getRequirementsList().map((r) => r.id);
    expect(ids).toEqual(['FUR-300-001']);
  });

  it('LLM이 첫 문맥과 일치한 항목은 -001로 병합, 불일치 항목은 새 ID로 분리한다', async () => {
    const state = new AgentState({
      pdfPath: '',
      templatePath: '',
      outputPath: '',
    });
    state.addRequirement({
      id: 'FUR-500',
      detail: '·항목 A\n·항목 B\n·항목 C\n·항목 D',
    });

    // 항목 A(기준), B(일치), C(불일치), D(일치)
    const partial: ContextAdvisor = {
      async judge(candidates) {
        const m = new Map<string, boolean[]>();
        for (const c of candidates) m.set(c.id, [true, true, false, true]);
        return m;
      },
    };

    await refineTool(state, partial);
    const result = state.getRequirementsList();
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(['FUR-500-001', 'FUR-500-002']);

    const merged = result.find((r) => r.id === 'FUR-500-001')!;
    expect(merged.detail).toContain('·항목 A');
    expect(merged.detail).toContain('·항목 B');
    expect(merged.detail).toContain('·항목 D');
    expect(merged.detail).not.toContain('·항목 C');

    const split = result.find((r) => r.id === 'FUR-500-002')!;
    expect(split.detail).toBe('·항목 C');
  });

});

describe('HeuristicContextAdvisor (non-API)', () => {
  it('유사한 토큰을 공유하는 항목은 -001로 병합, 다른 주제는 분리한다', async () => {
    const { HeuristicContextAdvisor } = await import('../src/llm/contextAdvisor');
    const advisor = new HeuristicContextAdvisor(0.2);
    const state = new AgentState({
      pdfPath: '',
      templatePath: '',
      outputPath: '',
    });
    state.addRequirement({
      id: 'FUR-700',
      detail: [
        '·과제공고 등록 및 조회 기능',
        '·과제공고 수정/삭제 기능',
        '·인사 기본정보 등록 검색',
      ].join('\n'),
    });

    await refineTool(state, advisor);
    const result = state.getRequirementsList();
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(['FUR-700-001', 'FUR-700-002']);

    const main = result.find((r) => r.id === 'FUR-700-001')!;
    expect(main.detail).toContain('과제공고 등록');
    expect(main.detail).toContain('과제공고 수정');

    const other = result.find((r) => r.id === 'FUR-700-002')!;
    expect(other.detail).toContain('인사 기본정보');
  });
});

describe('refineTool.classifyLine', () => {
  it('들여쓰기 깊이와 첫 비공백 특수문자를 식별한다', () => {
    expect(__test.classifyLine('  ○ 항목').indent).toBe(2);
    expect(__test.classifyLine('  ○ 항목').bullet).toBe('○');
    expect(__test.classifyLine('- 항목').bullet).toBe('-');
    expect(__test.classifyLine('일반 텍스트').bullet).toBeNull();
  });

  it('하이픈은 공백이 뒤따를 때만 bullet으로 본다', () => {
    expect(__test.classifyLine('-100').bullet).toBeNull();
    expect(__test.classifyLine('- 항목').bullet).toBe('-');
  });
});

describe('refineTool.splitDetail (indent-aware)', () => {
  it('더 들여쓴 bullet은 직전 상위 항목 본문에 귀속된다', () => {
    const parts = __test.splitDetail('○ 상위1\n  - 하위1\n  - 하위2\n○ 상위2');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('○ 상위1');
    expect(parts[0]).toContain('- 하위1');
    expect(parts[0]).toContain('- 하위2');
    expect(parts[1]).toContain('○ 상위2');
  });

  it('첫 bullet 이전의 preamble은 첫 분리 항목에 합쳐져 보존된다', () => {
    const parts = __test.splitDetail('도입 문맥 1줄\n도입 문맥 2줄\n○ 항목 A\n○ 항목 B');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('도입 문맥 1줄');
    expect(parts[0]).toContain('도입 문맥 2줄');
    expect(parts[0]).toContain('○ 항목 A');
    expect(parts[1]).toBe('○ 항목 B');
  });
});
