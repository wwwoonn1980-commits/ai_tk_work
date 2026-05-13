import { AgentState } from '../src/state/AgentState';
import { pdfTool } from '../src/tools/pdfTool';
import { parseTool } from '../src/tools/parseTool';

(async () => {
  const state = new AgentState({
    pdfPath: 'resource/doc/rfp/rfp.pdf',
    templatePath: '',
    outputPath: '',
    includeAll: true,
  });
  const pages = await pdfTool(state);
  await parseTool(state, pages);
  const reqs = state.getRequirementsList();
  console.log('---SUMMARY---');
  console.log('총 요구사항:', reqs.length);
  console.log('처음 3건:');
  for (const r of reqs.slice(0, 3)) {
    console.log({
      id: r.id,
      name: r.name,
      category: r.category,
      detailPreview: r.detail?.slice(0, 200),
    });
  }
  console.log('마지막 2건 ID:', reqs.slice(-2).map((r) => r.id));
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
