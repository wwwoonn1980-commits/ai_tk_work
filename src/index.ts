import { ExtractionAgent } from './manager/ExtractionAgent';
import { AgentConfig, SplitMode } from './types';

const VALID_MODES: SplitMode[] = ['merge', 'heuristic', 'llm', 'split-all'];

function parseArgs(argv: string[]): Partial<AgentConfig> & { help?: boolean } {
  const result: Partial<AgentConfig> & { help?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--pdf':
        result.pdfPath = argv[++i];
        break;
      case '--template':
        result.templatePath = argv[++i];
        break;
      case '--out':
        result.outputPath = argv[++i];
        break;
      case '--include-all':
        result.includeAll = true;
        break;
      case '--mode': {
        const m = argv[++i] as SplitMode;
        if (!VALID_MODES.includes(m)) {
          throw new Error(`--mode 값이 잘못됨: '${m}'. 사용 가능: ${VALID_MODES.join(', ')}`);
        }
        result.splitMode = m;
        break;
      }
      case '-h':
      case '--help':
        result.help = true;
        break;
    }
  }
  return result;
}

function printUsage(): void {
  console.log(`Usage: ts-node src/index.ts --pdf <path> --template <path> [--out <path>] [--mode <mode>] [--include-all]

Options:
  --pdf          입력 PDF 경로 (필수)
  --template     엑셀 템플릿 경로 (필수)
  --out          결과 xlsx 경로. 생략 시 output/output_YYYYMMDD_<unix_ts>.xlsx 자동 생성
  --mode         분리 모드 (기본 merge)
                   merge      : 모두 -001로 병합 (분류 없음)
                   heuristic  : 토큰 유사도 기반 분류 (API 불필요)
                   llm        : Claude API 사용 (ANTHROPIC_API_KEY 필요)
                   split-all  : top-bullet마다 강제 분리
  --include-all  세부내용이 없는 요구사항도 포함
  --help, -h     이 메시지 표시`);
}

export function defaultOutputPath(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const date = `${yyyy}${mm}${dd}`;
  const ts = Math.floor(now.getTime() / 1000);
  return `output/output_${date}_${ts}.xlsx`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.pdfPath || !args.templatePath) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const outputPath = args.outputPath ?? defaultOutputPath();

  const agent = new ExtractionAgent({
    pdfPath: args.pdfPath!,
    templatePath: args.templatePath!,
    outputPath,
    includeAll: args.includeAll,
    splitMode: args.splitMode,
  });

  const result = await agent.run();
  console.log(`\n요구사항 ${result.length}건이 ${outputPath}에 저장되었습니다.`);
}

main().catch((err) => {
  console.error('실행 실패:', err.message);
  process.exit(1);
});
