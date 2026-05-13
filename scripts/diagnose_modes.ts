import { AgentState } from '../src/state/AgentState';
import { pdfTool } from '../src/tools/pdfTool';
import { parseTool } from '../src/tools/parseTool';
import { refineTool } from '../src/tools/refineTool';
import { SplitMode } from '../src/types';

async function run(mode: SplitMode): Promise<{ total: number; splits: number }> {
  const state = new AgentState({
    pdfPath: 'resource/doc/rfp/rfp.pdf',
    templatePath: '',
    outputPath: '',
    includeAll: false,
    splitMode: mode,
  });
  const pages = await pdfTool(state);
  await parseTool(state, pages);
  await refineTool(state);
  const reqs = state.getRequirementsList();
  // 분리 발생: 동일 prefix에 -002 이상이 존재하는 경우
  const prefixes = new Map<string, number>();
  for (const r of reqs) {
    const m = r.id.match(/^(.+)-(\d{3})$/);
    if (!m) continue;
    const p = m[1];
    const seq = parseInt(m[2], 10);
    prefixes.set(p, Math.max(prefixes.get(p) ?? 0, seq));
  }
  let splits = 0;
  for (const v of prefixes.values()) if (v >= 2) splits++;
  return { total: reqs.length, splits };
}

(async () => {
  const modes: SplitMode[] = ['merge', 'heuristic', 'split-all'];
  console.log('mode\ttotal\t분리발생 후보수');
  for (const m of modes) {
    const r = await run(m);
    console.log(`${m}\t${r.total}\t${r.splits}`);
  }
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
