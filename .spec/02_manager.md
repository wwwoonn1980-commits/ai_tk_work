# 에이전트 관리자 명세서 (Manager Specification)

## 1. 개요
Manager 컴포넌트(`ExtractionAgent` 등)는 에이전트의 워크플로우를 통제하는 중앙 관제탑 역할을 합니다. 비즈니스 로직(도구의 내부 구현)은 알 필요가 없으며, 오직 작업의 흐름과 예외 처리만을 책임져야 합니다.

## 2. 인터페이스 명세

### 2.1. 생성자 (Constructor)
- **입력 파라미터**: 작업 수행에 필요한 초기 설정 객체 (예: `pdfPath`, `templatePath`, `outputPath`, `includeAll` 등)
- **수행 역할**: 
  - 전달받은 설정값을 기반으로 새로운 `AgentState` (메모리) 인스턴스를 초기화해야 합니다.

### 2.2. 실행 메서드 (예: `async run()`)
- **수행 역할**: 정의된 파이프라인 순서대로 도구(Tools)들을 호출하는 비동기 함수입니다.
- **필수 동작 요건**:
  1. 시작 시 State의 `status`를 `running`으로 설정합니다.
  2. 도구 호출 전후로 적절한 로그를 State를 통해 남깁니다 (`state.addLog`).
  3. `pdfTool` -> `parseTool` -> `refineTool` -> `excelTool` 순으로 제어 흐름을 가져갑니다. `refineTool`은 파싱이 완료된 직후, 엑셀 기록 직전에 호출되어야 합니다.
  4. 파싱 도구 실행 후, State에 추출된 요구사항이 없다면(0건) 예외를 발생시켜 빈 파일이 생성되는 것을 방지해야 합니다. (검사 시점은 `refineTool` 호출 이전입니다.)
  5. 성공 시 State의 `status`를 `completed`로 설정하고 최종 결과 배열을 반환합니다.
  6. **예외 처리**: 어떤 도구에서든 에러가 발생하면 `catch` 블록에서 State의 `status`를 `error`로 변경하고, 에러 로그를 남긴 후 에러를 상위로 전파(throw)해야 합니다.
