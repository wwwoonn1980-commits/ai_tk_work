export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

export type SplitMode = 'merge' | 'heuristic' | 'llm' | 'split-all';

export interface Requirement {
  id: string;
  name?: string;
  type?: string;
  category?: string;
  definitionName?: string;
  detail: string;
  source?: { page: number };
}

export interface AgentConfig {
  pdfPath: string;
  templatePath: string;
  outputPath: string;
  includeAll?: boolean;
  splitMode?: SplitMode;
}
