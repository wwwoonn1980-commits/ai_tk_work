import { AgentState } from '../src/state/AgentState';
import { pdfTool } from '../src/tools/pdfTool';
import { parseTool } from '../src/tools/parseTool';

(async () => {
  const state = new AgentState({
    pdfPath: 'resource/doc/rfp/rfp.pdf',
    templatePath: '',
    outputPath: '',
    includeAll: false,
  });
  const pages = await pdfTool(state);
  await parseTool(state, pages);
  const reqs = state.getRequirementsList();
  console.log('총 요구사항:', reqs.length);
  console.log('\n--- 처음 5건 (id / detail 첫 300자) ---');
  for (const r of reqs.slice(0, 5)) {
    console.log(`\n[${r.id}] name=${r.name ?? ''} / definitionName=${r.definitionName ?? '(none)'}`);
    console.log(`  detail(${(r.detail ?? '').length}자):`);
    const lines = (r.detail ?? '').split('\n').slice(0, 8);
    for (const l of lines) console.log(`    "${l}"`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
