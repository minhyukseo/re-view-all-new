# 전체 코드 리뷰 Plan

## TL;DR

> **Quick Summary**: 전체 코드베이스(web/, server/, edge-worker/)를 버그/에러 중심으로 AI + 도구方式进行 리뷰
>
> **Deliverables**:
> - 버그/오류 목록 (严重/警告/정보)
> - 에러 처리 미흡 부분
> - 잠재적 런타임 에러
> - 코드 품질 이슈
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES (3 waves)
> **Critical Path**: Wave 1 → Wave 2 → Wave 3 → 리포트 정리

---

## Context

### Original Request
사용자가 전체 코드 리뷰 요청:
- 범위: 전체 (web/, server/, edge-worker/)
- 초점: 버그/에러
- 방식: AI + 도구 (LSP, 패턴 분석)

### 프로젝트 구조
- **web/** — Next.js 프론트엔드 (React/TypeScript)
- **server/** — Cloudflare Workers 백엔드
- **edge-worker/** — Edge Worker
- **web_fix/** — 수정된 웹 파일들 (참조용)

### 파일 현황
- 총 24개 TS/TSX/JS 파일
- TypeScript/JavaScript만 사용

---

## Work Objectives

### Core Objective
전체 코드베이스에서 버그, 에러 처리 문제, 잠재적 런타임 에러를 발견하고 보고

### Concrete Deliverables
- `/mng/bug-report.md` — 발견된 버그/에러 목록 (심각도별 분류)
- `/mng/security-issues.md` — 보안 관련 이슈
- `/mng/quality-report.md` — 코드 품질 요약

### Definition of Done
- [ ] 모든 TS/JS 파일 LSP diagnostics 실행 완료
- [ ] 공통 버그 패턴 스캔 완료
- [ ] 에러 처리 누락 검사 완료
- [ ] 리포트 파일 생성 완료

### Must Have
- TypeScript 컴파일 에러/경고
- try-catch 없는 비동기 호출
- 에러 처리 누락
- 잠재적 null/undefined 참조
- 타입 불일치

### Must NOT Have
- 리팩토링 제안 (버그 리뷰 범위 초과)
- 스타일Lint (별도 요청 없음)
- 성능 최적화 (별도 요청 없음)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: N/A (리뷰 작업)
- **Automated tests**: N/A
- **Framework**: N/A

### QA Policy
리뷰 결과는 문서로 검증:
- 파일 존재 여부
- 발견된 이슈 수
- 심각도별 분류 정확성

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (LSP Diagnostics — 즉시 실행):
├── Task 1: web/ 디렉토리 LSP diagnostics
├── Task 2: server/ 디렉토리 LSP diagnostics
└── Task 3: edge-worker/ 디렉토리 LSP diagnostics

Wave 2 (버그 패턴 스캔 — 병렬):
├── Task 4: try-catch 누락 패턴 스캔
├── Task 5: async/await 누락 패턴 스캔
├── Task 6: null/undefined 접근 패턴 스캔
└── Task 7: 보안 취약점 패턴 스캔

Wave 3 (深度 분석 — 병렬):
├── Task 8: web/ 핵심 파일 심층 분석
├── Task 9: server/ 핵심 파일 심층 분석
├── Task 10: edge-worker/ 핵심 파일 심층 분석
└── Task 11: web_fix/ vs web/ 차이점 분석

Wave FINAL (결과 정리):
└── Task 12: 리포트 통합 및 분류
```

### Dependency Matrix
- 1-3: — (독립적)
- 4-7: Wave 1 완료 후 실행 가능
- 8-11: 4-7 완료 후 실행
- 12: 8-11 완료 후

### Agent Dispatch Summary
- **1**: **3** — T1 → `unspecified-high`, T2 → `unspecified-high`, T3 → `unspecified-high`
- **2**: **4** — T4 → `unspecified-high`, T5 → `unspecified-high`, T6 → `unspecified-high`, T7 → `unspecified-high`
- **3**: **4** — T8 → `deep`, T9 → `deep`, T10 → `deep`, T11 → `deep`
- **4**: **1** — T12 → `writing`

---

## TODOs

- [ ] 1. web/ LSP Diagnostics 실행

  **What to do**:
  - `lsp_diagnostics` tool로 web/ 모든 TS/TSX 파일 diagnostics 실행
  - 에러, 경고, 힌트 수집
  - 파일별 분류하여 저장

  **Must NOT do**:
  - 파일 수정 (읽기 전용 분석)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Skills Evaluated but Omitted**: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4-7
  - **Blocked By**: None

  **References**:
  - `web/` — 대상 디렉토리

  **Acceptance Criteria**:
  - [ ] web/ 모든 TS/TSX 파일 diagnostics 완료
  - [ ] 에러/경고/힌트 각각 분류됨

  **QA Scenarios**:
  ```
  Scenario: web/ diagnostics 완료
    Tool: lsp_diagnostics
    Preconditions: web/ 디렉토리에 TS/TSX 파일 존재
    Steps:
      1. web/ 모든 TS/TSX 파일에 대해 lsp_diagnostics 실행
      2. 결과를 severity별( error, warning, information)로 분류
      3. 각 파일별 결과 저장
    Expected Result: 모든 파일 diagnostics 완료, 결과 수집
    Evidence: command output

  Scenario: diagnostics 결과为空
    Tool: lsp_diagnostics
    Preconditions: 해당 파일에 diagnostics 없음
    Steps:
      1. diagnostics 실행
      2. 빈 결과 확인
    Expected Result: 빈 배열 반환
    Evidence: command output
  ```

  **Commit**: NO

---

- [ ] 2. server/ LSP Diagnostics 실행

  **What to do**:
  - `lsp_diagnostics` tool로 server/ 모든 TS/TSX 파일 diagnostics 실행
  - 에러, 경고, 힌트 수집

  **Must NOT do**:
  - 파일 수정 (읽기 전용 분석)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4-7
  - **Blocked By**: None

  **References**:
  - `server/` — 대상 디렉토리

  **Acceptance Criteria**:
  - [ ] server/ 모든 TS/TSX 파일 diagnostics 완료

  **QA Scenarios**:
  ```
  Scenario: server/ diagnostics 완료
    Tool: lsp_diagnostics
    Preconditions: server/ 디렉토리에 TS/TSX 파일 존재
    Steps:
      1. server/ 모든 TS/TSX 파일에 대해 lsp_diagnostics 실행
      2. 결과 수집
    Expected Result: 모든 파일 diagnostics 완료
    Evidence: command output
  ```

  **Commit**: NO

---

- [ ] 3. edge-worker/ LSP Diagnostics 실행

  **What to do**:
  - `lsp_diagnostics` tool로 edge-worker/ 모든 TS 파일 diagnostics 실행

  **Must NOT do**:
  - 파일 수정 (읽기 전용 분석)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 4-7
  - **Blocked By**: None

  **References**:
  - `edge-worker/` — 대상 디렉토리

  **Acceptance Criteria**:
  - [ ] edge-worker/ 모든 TS 파일 diagnostics 완료

  **QA Scenarios**:
  ```
  Scenario: edge-worker/ diagnostics 완료
    Tool: lsp_diagnostics
    Preconditions: edge-worker/ 디렉토리에 TS 파일 존재
    Steps:
      1. edge-worker/ 모든 TS 파일에 대해 lsp_diagnostics 실행
      2. 결과 수집
    Expected Result: 모든 파일 diagnostics 완료
    Evidence: command output
  ```

  **Commit**: NO

---

- [ ] 4. try-catch 누락 패턴 스캔

  **What to do**:
  - `ast_grep_search`로 try-catch 없는 async 함수 검색
  - Promise rejection 가능성 체크
  - fs operations, network calls 등

  **Must NOT do**:
  - 파일 수정

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Tasks 8-11
  - **Blocked By**: Tasks 1-3

  **References**:
  - Pattern: `async function $FUNC() { await $CALL(...) }` without try-catch

  **Acceptance Criteria**:
  - [ ] try-catch 없는 async 함수 목록 수집
  - [ ] 각 항목 위치 기록

  **QA Scenarios**:
  ```
  Scenario: try-catch 누락 패턴 발견
    Tool: ast_grep_search
    Preconditions: async 함수에 try-catch 없음
    Steps:
      1. async function 패턴 검색
      2. 해당 함수에 try-catch 포함 여부 확인
    Expected Result: try-catch 없는 async 함수 목록
    Evidence: grep output
  ```

  **Commit**: NO

---

- [ ] 5. async/await 누락 패턴 스캔

  **What to do**:
  - `ast_grep_search`로 Promise 반환 함수 호출 후 await 없이 사용 검색
  - `.then().catch()` 패턴 vs async/await 일관성 체크

  **Must NOT do**:
  - 파일 수정

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6, 7)

  **References**:
  - Pattern: `$VAR = someAsyncFunc()` where return type is Promise

  **Acceptance Criteria**:
  - [ ] await 없는 Promise 사용 목록 수집

  **QA Scenarios**:
  ```
  Scenario: async/await 누락 발견
    Tool: ast_grep_search
    Preconditions: 비동기 함수 결과 변수에 저장
    Steps:
      1. Promise 반환 함수 호출 패턴 검색
      2. await 키워드 포함 여부 확인
    Expected Result: await 없는 호출 목록
    Evidence: grep output
  ```

  **Commit**: NO

---

- [ ] 6. null/undefined 접근 패턴 스캔

  **What to do**:
  - `ast_grep_search`로 optional chaining 없는 프로퍼티 접근 검색
  - `!.` (non-null assertion) 남용 체크
  - 타입 가드 없는 null 체크

  **Must NOT do**:
  - 파일 수정

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 7)

  **References**:
  - Pattern: `$OBJ.$PROP` where $OBJ could be null

  **Acceptance Criteria**:
  - [ ] null/undefined 접근 가능성 있는 패턴 목록 수집

  **QA Scenarios**:
  ```
  Scenario: null/undefined 접근 발견
    Tool: ast_grep_search
    Preconditions: optional chaining 없는 접근
    Steps:
      1. 프로퍼티 접근 패턴 검색
      2. null 체크 여부 확인
    Expected Result: 위험한 접근 패턴 목록
    Evidence: grep output
  ```

  **Commit**: NO

---

- [ ] 7. 보안 취약점 패턴 스캔

  **What to do**:
  - `ast_grep_search`로 보안 관련 패턴 검색:
    - `eval()`, `new Function()`
    - `innerHTML` 사용
    - `dangerouslySetInnerHTML`
    - 하드코딩된 credential/secret
    - SQL-like 문자열拼接
  - `grep`로 `.env`, credential 패턴 검색

  **Must NOT do**:
  - 파일 수정

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)

  **References**:
  - Pattern: `eval($ARG)`, `new Function($ARGS)`
  - Pattern: `dangerouslySetInnerHTML`
  - Pattern: `.innerHTML = $VAL`

  **Acceptance Criteria**:
  - [ ] 보안 위험 패턴 목록 수집
  - [ ] 각 항목 위험도 분류

  **QA Scenarios**:
  ```
  Scenario: eval() 사용 발견
    Tool: ast_grep_search
    Preconditions: eval() 함수 사용
    Steps:
      1. eval 패턴 검색
      2. 사용 위치 기록
    Expected Result: eval 사용 목록
    Evidence: grep output

  Scenario: dangerouslySetInnerHTML 사용
    Tool: ast_grep_search
    Preconditions: React에서 innerHTML 직접 설정
    Steps:
      1. dangerouslySetInnerHTML 패턴 검색
      2. sanitization 여부 확인
    Expected Result: 사용 목록 + sanitization 여부
    Evidence: grep output
  ```

  **Commit**: NO

---

- [ ] 8. web/ 핵심 파일 심층 분석

  **What to do**:
  - web/ 핵심 파일 직접 읽기 및 분석:
    - `app/page.tsx`, `app/layout.tsx`, `app/list/page.tsx`
    - `components/PostCard.tsx`, `components/FilterModal.tsx`
    - `lib/api.ts`, `lib/time.ts`
  - 비즈니스 로직 버그 탐지
  - 상태 관리 이슈
  - API 호출 에러 처리

  **Must NOT do**:
  - 파일 수정
  - 리팩토링 제안 (버그 발견에만 집중)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 4-7

  **References**:
  - `web/app/page.tsx` — 메인 페이지
  - `web/app/list/page.tsx` — 리스트 페이지
  - `web/components/*.tsx` — UI 컴포넌트
  - `web/lib/api.ts` — API 클라이언트

  **Acceptance Criteria**:
  - [ ] 모든 핵심 파일 분석 완료
  - [ ] 발견된 버그 목록 작성
  - [ ] 에러 처리 누락 지적

  **QA Scenarios**:
  ```
  Scenario: web/ 분석 완료
    Tool: read
    Preconditions: 분석 대상 파일 존재
    Steps:
      1. 각 파일 읽기
      2. 버그 패턴 분석
      3. 결과 기록
    Expected Result: 버그 목록 문서화
    Evidence: /mng/web-bugs.md
  ```

  **Commit**: NO

---

- [ ] 9. server/ 핵심 파일 심층 분석

  **What to do**:
  - server/ 핵심 파일 직접 읽기 및 분석:
    - `server/src/index.ts` — 메인 엔트리
  - Cloudflare Workers API 핸들러
  - 데이터 처리 로직
  - CORS, Authentication 처리

  **Must NOT do**:
  - 파일 수정

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 10, 11)

  **References**:
  - `server/src/index.ts` — Cloudflare Workers 엔트리

  **Acceptance Criteria**:
  - [ ] server/ 핵심 파일 분석 완료
  - [ ] 발견된 버그 목록 작성

  **QA Scenarios**:
  ```
  Scenario: server/ 분석 완료
    Tool: read
    Preconditions: 분석 대상 파일 존재
    Steps:
      1. 파일 읽기
      2. API 핸들러 버그 분석
      3. 결과 기록
    Expected Result: 버그 목록 문서화
    Evidence: /mng/server-bugs.md
  ```

  **Commit**: NO

---

- [ ] 10. edge-worker/ 핵심 파일 심층 분석

  **What to do**:
  - edge-worker/ 핵심 파일 직접 읽기 및 분석:
    - `edge-worker/src/index.ts`
  - Edge computing 로직
  - Cache 처리
  - Request/Response 핸들링

  **Must NOT do**:
  - 파일 수정

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 11)

  **References**:
  - `edge-worker/src/index.ts` — Edge Worker 엔트리

  **Acceptance Criteria**:
  - [ ] edge-worker/ 분석 완료
  - [ ] 발견된 버그 목록 작성

  **QA Scenarios**:
  ```
  Scenario: edge-worker/ 분석 완료
    Tool: read
    Preconditions: 분석 대상 파일 존재
    Steps:
      1. 파일 읽기
      2. Edge 로직 버그 분석
      3. 결과 기록
    Expected Result: 버그 목록 문서화
    Evidence: /mng/edge-bugs.md
  ```

  **Commit**: NO

---

- [ ] 11. web_fix/ vs web/ 차이점 분석

  **What to do**:
  - `bash diff` 또는 파일 비교로 web_fix/와 web/ 차이점 분석
  - web_fix에서 수정된 내용 → 원본 web/에 어떤 버그가 있었는지 추론
  - 수정된 패턴 → 기존 코드에 동일한 버그가 있는지 체크

  **Must NOT do**:
  - 파일 수정

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 10)

  **References**:
  - `web/` vs `web_fix/` 파일 비교

  **Acceptance Criteria**:
  - [ ] 차이점 목록 작성
  - [ ] 수정된 버그 유형 분류

  **QA Scenarios**:
  ```
  Scenario: web_fix vs web 비교 완료
    Tool: bash (diff)
    Preconditions: 두 디렉토리 존재
    Steps:
      1. diff 명령으로 차이점 분석
      2. 수정 패턴 문서화
    Expected Result: 차이점 리포트
    Evidence: /mng/web-fix-analysis.md
  ```

  **Commit**: NO

---

- [ ] 12. 리포트 통합 및 분류

  **What to do**:
  - 모든 Wave에서 수집된 결과 통합
  - `/mng/bug-report.md` 생성:
    - 심각도: CRITICAL / WARNING / INFO
    - 카테고리: 버그 / 에러처리 / 보안 / 타입
    - 파일: 라인
    - 설명
    - 권장 수정방안 (간단히)
  - `/mng/security-issues.md` — 보안 관련 별도 정리
  - `/mng/quality-summary.md` — 요약

  **Must NOT do**:
  - 코드 수정

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: FINAL
  - **Blocked By**: Tasks 8-11

  **References**:
  - 이전 태스크에서 수집된 모든 결과

  **Acceptance Criteria**:
  - [ ] `/mng/bug-report.md` 생성
  - [ ] `/mng/security-issues.md` 생성
  - [ ] `/mng/quality-summary.md` 생성
  - [ ] 총 발견된 이슈 수记载

  **QA Scenarios**:
  ```
  Scenario: 리포트 생성 완료
    Tool: write
    Preconditions: 모든 분석 완료
    Steps:
      1. 결과 수집
      2. 카테고리별 분류
      3. Markdown 문서 작성
    Expected Result: 3개 리포트 파일 생성
    Evidence: /mng/*.md 파일 존재
  ```

  **Commit**: NO

---

## Final Verification Wave

> 모든 분석 및 리포트 작성 완료 후 검토

- [ ] F1. **리포트 완성성 검증** — `unspecified-high`
  - 모든 evidence 파일 존재 확인
  - 총 발견된 이슈 수 정확성
  - 심각도 분류 적절성

- [ ] F2. **결과 프리젠테이션** — `writing`
  - 사용자에게 결과를 명확하게 전달
  - 우선순위별 정렬 (CRITICAL 먼저)
  - 각 이슈에 대한 간략한 설명

---

## Success Criteria

### Verification Commands
```bash
ls /mng/*.md  # 리포트 파일 존재 확인
```

### Final Checklist
- [ ] 모든 TS/JS 파일 LSP diagnostics 완료
- [ ] 버그 패턴 스캔 완료
- [ ] 심층 분석 완료
- [ ] 리포트 파일 생성 완료
- [ ] 발견된 이슈 수 만큼 확인됨

---

## 예상 발견 사항

Wave 1 (LSP Diagnostics)에서 발견될 수 있는 것:
- TypeScript 타입 에러/경고
- 정의되지 않은 변수
- 잘못된 import 경로

Wave 2 (버그 패턴)에서 발견될 수 있는 것:
- try-catch 없는 비동기 호출
- optional chaining 누락
- eval() 사용 등 보안 위험

Wave 3 (심층 분석)에서 발견될 수 있는 것:
- API 에러 처리 누락
- 상태 관리 버그
- 비동기 경쟁 조건
