import { AgentState } from '../state/AgentState';
import { AgentConfig, Requirement } from '../types';
import { pdfTool } from '../tools/pdfTool';
import { parseTool } from '../tools/parseTool';
import { refineTool } from '../tools/refineTool';
import { excelTool } from '../tools/excelTool';

export class ExtractionAgent {
  readonly state: AgentState;

  constructor(config: AgentConfig) {
    this.state = new AgentState(config);
  }

  async run(): Promise<Requirement[]> {
    this.state.status = 'running';
    this.state.addLog('ExtractionAgent: 파이프라인 시작');

    try {
      const pages = await pdfTool(this.state);
      await parseTool(this.state, pages);
      if (this.state.getRequirementsList().length === 0) {
        throw new Error('파싱된 요구사항이 0건입니다. 빈 파일 저장을 방지합니다.');
      }
      await refineTool(this.state);
      const rows = await excelTool(this.state);

      this.state.status = 'completed';
      this.state.addLog(`ExtractionAgent: 완료 (저장 ${rows}행)`);
      return this.state.getRequirementsList();
    } catch (err) {
      this.state.status = 'error';
      this.state.addLog(`ExtractionAgent: 오류 - ${(err as Error).message}`);
      throw err;
    }
  }
}
