import { describe, it, expect, vi } from 'vitest';
import { __test } from '../src/tools/parseTool';

vi.spyOn(console, 'log').mockImplementation(() => undefined);

describe('parseTool.splitIntoBlocks', () => {
  it('요구사항 고유번호 헤더로 블록을 분리한다', () => {
    const pages = [
      [
        '요구사항 고유번호 FUR-001',
        '요구사항 분류 기능',
        '요구사항 명칭 프레임워크',
        '정의 표준프레임워크 적용',
        '·항목 A',
        '요구사항 고유번호 FUR-002',
        '요구사항 분류 기능',
        '요구사항 명칭 공통 코드관리',
        '·항목 B',
      ].join('\n'),
    ];
    const blocks = __test.splitIntoBlocks(pages);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].id).toBe('FUR-001');
    expect(blocks[1].id).toBe('FUR-002');
    expect(blocks[0].page).toBe(1);
  });

  it('헤더 없는 페이지는 무시한다', () => {
    const blocks = __test.splitIntoBlocks(['표지 페이지', '본문 내용']);
    expect(blocks).toHaveLength(0);
  });
});

describe('parseTool.blockToRequirement', () => {
  it('정의 라인 자체만 폐기되고 이후 bullet 라인은 detail에 자동 진입한다', () => {
    const block = {
      id: 'FUR-001',
      page: 5,
      lines: [
        '요구사항 분류 기능',
        '요구사항 명칭 프레임워크',
        '정의 표준프레임워크 적용',
        '·첫 번째 항목',
        '본문 연속 라인',
        '세부내용',
        '·구축 항목 A',
        '·도입 항목 B',
        '산출 정보',
      ],
    };
    const req = __test.blockToRequirement(block);
    expect(req.id).toBe('FUR-001');
    expect(req.category).toBe('기능');
    expect(req.name).toBe('프레임워크');
    expect(req.source).toEqual({ page: 5 });
    // 정의 라인의 텍스트는 definitionName(요구사항정의명)으로 보존
    expect(req.definitionName).toBe('표준프레임워크 적용');
    // 정의 텍스트는 detail에는 포함되지 않음
    expect(req.detail).not.toContain('표준프레임워크 적용');
    // 정의 다음 라인의 bullet은 detail에 포함 (자동 진입)
    expect(req.detail).toContain('·첫 번째 항목');
    // detail 모드 진입 후 비-bullet 연속 라인도 포함
    expect(req.detail).toContain('본문 연속 라인');
    // 명시적 '세부내용' 마커 이후의 bullet도 정상 포함
    expect(req.detail).toContain('·구축 항목 A');
    expect(req.detail).toContain('·도입 항목 B');
    // 산출 정보 이후는 제외
    expect(req.detail).not.toContain('산출');
  });
});

describe('parseTool.ID_PATTERN', () => {
  it('알려진 접두어 ID를 매칭한다', () => {
    expect('FUR-001').toMatch(__test.ID_PATTERN);
    expect('NFR-12').toMatch(__test.ID_PATTERN);
    expect('COR-9999').toMatch(__test.ID_PATTERN);
    expect('XYZ-1').not.toMatch(__test.ID_PATTERN);
  });
});
