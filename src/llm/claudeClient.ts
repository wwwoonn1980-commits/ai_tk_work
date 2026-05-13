import { Requirement } from '../types';

export interface LLMEnricher {
  enrich(pages: string[], existing: Requirement[]): Promise<Requirement[]>;
}

export class StubEnricher implements LLMEnricher {
  async enrich(_pages: string[], _existing: Requirement[]): Promise<Requirement[]> {
    return [];
  }
}

export function createEnricher(): LLMEnricher {
  return new StubEnricher();
}
