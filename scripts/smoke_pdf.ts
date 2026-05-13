import * as fs from 'fs';
import { AgentState } from '../src/state/AgentState';
import { pdfTool } from '../src/tools/pdfTool';

(async () => {
  const state = new AgentState({
    pdfPath: 'resource/doc/rfp/rfp.pdf',
    templatePath: '',
    outputPath: '',
  });
  const pages = await pdfTool(state);
  console.log('---SUMMARY---');
  console.log('pages:', pages.length);

  const dump = pages
    .map((p, i) => `===PAGE ${i + 1}===\n${p}`)
    .join('\n\n');
  fs.writeFileSync('scripts/pdf_dump.txt', dump, 'utf-8');
  console.log('dump bytes:', dump.length);
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
