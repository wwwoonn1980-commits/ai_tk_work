import { AgentState } from '../src/state/AgentState';
import { pdfTool } from '../src/tools/pdfTool';
import { parseTool } from '../src/tools/parseTool';
import { refineTool, __test } from '../src/tools/refineTool';
import { createContextAdvisor, ContextCandidate } from '../src/llm/contextAdvisor';

(async () => {
  console.log('ANTHROPIC_API_KEY set?', Boolean(process.env.ANTHROPIC_API_KEY));

  const state = new AgentState({
    pdfPath: 'resource/doc/rfp/rfp.pdf',
    templatePath: '',
    outputPath: '',
    includeAll: false,
  });
  const pages = await pdfTool(state);
  await parseTool(state, pages);

  const reqs = state.getRequirementsList();
  console.log(`총 요구사항: ${reqs.length}`);

  // splitDetail 결과 분석
  const splitDist = new Map<number, number>();
  const candidates: ContextCandidate[] = [];
  for (const r of reqs) {
    const items = __test.splitDetail(r.detail);
    splitDist.set(items.length, (splitDist.get(items.length) ?? 0) + 1);
    if (items.length > 1) candidates.push({ id: r.id, items });
  }
  console.log('\nsplitDetail item-count 분포:');
  for (const [k, v] of Array.from(splitDist.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`  ${k}개 → ${v}건`);
  }
  console.log(`\nLLM 호출 대상(2개 이상): ${candidates.length}건`);

  if (candidates.length === 0) {
    console.log('LLM 호출 후보 없음.');
    return;
  }

  // 첫 3 후보의 splitItems 미리보기
  console.log('\n첫 3 후보 미리보기:');
  for (const c of candidates.slice(0, 3)) {
    console.log(`\n[${c.id}] items=${c.items.length}`);
    c.items.forEach((s, i) =>
      console.log(`  (${i + 1}) ${s.replace(/\s+/g, ' ').slice(0, 100)}`)
    );
  }

  // 실제 LLM 호출
  const advisor = createContextAdvisor();
  console.log(`\nAdvisor: ${advisor.constructor.name}`);
  const verdicts = await advisor.judge(candidates);

  // 결과 통계
  let allTrue = 0;
  let mixed = 0;
  let sampleSplit: { id: string; matches: boolean[] } | null = null;
  for (const c of candidates) {
    const v = verdicts.get(c.id) ?? [];
    const trueCount = v.filter(Boolean).length;
    if (trueCount === v.length) allTrue++;
    else {
      mixed++;
      if (!sampleSplit) sampleSplit = { id: c.id, matches: v };
    }
  }
  console.log(`\nLLM 응답 통계:`);
  console.log(`  모두 일치 (분리 없음): ${allTrue}건`);
  console.log(`  일부 불일치 (분리 발생): ${mixed}건`);
  if (sampleSplit) {
    console.log(`\n분리 발생 샘플 [${sampleSplit.id}]: ${JSON.stringify(sampleSplit.matches)}`);
  }
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
