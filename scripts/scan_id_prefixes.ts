import * as fs from 'fs';

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync('resource/doc/rfp/rfp.pdf'));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const counts: Record<string, Set<string>> = {};
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as any[]).map((it: any) => it.str || '').join(' ');
    const matches = text.match(/요구사항\s*고유번호\s*([A-Z]{2,4})-(\d{2,4})/g) || [];
    for (const m of matches) {
      const idMatch = m.match(/([A-Z]{2,4})-(\d{2,4})/);
      if (!idMatch) continue;
      const prefix = idMatch[1];
      const full = `${idMatch[1]}-${idMatch[2]}`;
      if (!counts[prefix]) counts[prefix] = new Set();
      counts[prefix].add(full);
    }
  }
  console.log('Distinct requirement IDs per prefix:');
  let total = 0;
  for (const [k, set] of Object.entries(counts).sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  ${k}: ${set.size} ids`);
    total += set.size;
  }
  console.log(`TOTAL: ${total}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
