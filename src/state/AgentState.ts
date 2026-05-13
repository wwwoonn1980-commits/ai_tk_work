import { AgentConfig, AgentStatus, Requirement, SplitMode } from '../types';

export class AgentState {
  pdfPath: string;
  templatePath: string;
  outputPath: string;
  includeAll: boolean;
  splitMode: SplitMode;

  totalPages = 0;
  currentPage = 0;
  status: AgentStatus = 'idle';

  logs: string[] = [];
  requirements: Map<string, Requirement> = new Map();

  constructor(config: AgentConfig) {
    this.pdfPath = config.pdfPath;
    this.templatePath = config.templatePath;
    this.outputPath = config.outputPath;
    this.includeAll = config.includeAll ?? false;
    this.splitMode = config.splitMode ?? 'merge';
  }

  addLog(message: string): void {
    const line = `[${new Date().toISOString()}] ${message}`;
    this.logs.push(line);
    console.log(line);
  }

  addRequirement(req: Requirement): void {
    const existing = this.requirements.get(req.id);
    if (!existing) {
      this.requirements.set(req.id, { ...req });
      return;
    }

    const merged: Requirement = { ...existing };
    for (const key of ['name', 'type', 'category'] as const) {
      if (!merged[key] && req[key]) {
        merged[key] = req[key];
      }
    }
    if (req.detail) {
      const incoming = req.detail.trim();
      const current = (merged.detail ?? '').trim();
      if (!current) {
        merged.detail = incoming;
      } else if (!current.includes(incoming)) {
        merged.detail = `${current}\n${incoming}`;
      }
    }
    if (!merged.definitionName && req.definitionName) {
      merged.definitionName = req.definitionName;
    }
    if (!merged.source && req.source) {
      merged.source = req.source;
    }
    this.requirements.set(req.id, merged);
  }

  getRequirementsList(): Requirement[] {
    return Array.from(this.requirements.values());
  }
}
