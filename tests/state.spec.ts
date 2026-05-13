import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentState } from '../src/state/AgentState';

describe('AgentState', () => {
  let state: AgentState;

  beforeEach(() => {
    state = new AgentState({
      pdfPath: 'in.pdf',
      templatePath: 't.xlsx',
      outputPath: 'o.xlsx',
    });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('초기 상태가 idle이고 includeAll 기본값이 false다', () => {
    expect(state.status).toBe('idle');
    expect(state.includeAll).toBe(false);
    expect(state.totalPages).toBe(0);
    expect(state.requirements.size).toBe(0);
  });

  it('addLog는 ISO timestamp 접두를 붙여 logs에 push한다', () => {
    state.addLog('hello');
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+Z\] hello$/);
  });

  it('addRequirement는 신규 ID를 그대로 저장한다', () => {
    state.addRequirement({ id: 'FUR-001', name: '프레임워크', detail: '·항목 A' });
    const list = state.getRequirementsList();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'FUR-001', name: '프레임워크', detail: '·항목 A' });
  });

  it('동일 ID 추가 시 빈 필드만 채우고 detail은 concat한다', () => {
    state.addRequirement({ id: 'FUR-001', name: '프레임워크', category: '기능', detail: '·항목 A' });
    state.addRequirement({ id: 'FUR-001', name: '덮어쓰면안됨', category: '', detail: '·항목 B' });

    const req = state.requirements.get('FUR-001')!;
    expect(req.name).toBe('프레임워크');
    expect(req.category).toBe('기능');
    expect(req.detail).toBe('·항목 A\n·항목 B');
  });

  it('detail 중복분은 다시 추가하지 않는다', () => {
    state.addRequirement({ id: 'FUR-002', detail: '·항목 A' });
    state.addRequirement({ id: 'FUR-002', detail: '·항목 A' });
    expect(state.requirements.get('FUR-002')!.detail).toBe('·항목 A');
  });

  it('빈 필드는 후행 값으로 채워진다', () => {
    state.addRequirement({ id: 'FUR-003', detail: '내용' });
    state.addRequirement({ id: 'FUR-003', name: '이름', detail: '' });
    expect(state.requirements.get('FUR-003')!.name).toBe('이름');
  });
});
