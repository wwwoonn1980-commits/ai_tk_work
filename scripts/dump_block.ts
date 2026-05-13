import { AgentState } from '../src/state/AgentState';
import { pdfTool } from '../src/tools/pdfTool';
import { __test } from '../src/tools/parseTool';

(async () => {
  const state = new AgentState({
    pdfPath: 'resource/doc/rfp/rfp.pdf',
    templatePath: '',
    outputPath: '',
    includeAll: false,
  });
  const pages = await pdfTool(state);

  // Dump pages where FUR-001/002 appear
  const targetIds = ['FUR-001', 'FUR-002', 'FUR-003'];
  const blocks = __test.splitIntoBlocks(pages);
  for (const t of targetIds) {
    const b = blocks.find((x) => x.id === t);
    if (!b) {
      console.log(`\n=== ${t} NOT FOUND ===`);
      continue;
    }
    console.log(`\n=== ${t} (page ${b.page}, ${b.lines.length} lines) ===`);
    b.lines.forEach((line, i) => {
      console.log(`  ${i.toString().padStart(2)}: "${line}"`);
    });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
