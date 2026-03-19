# 버그/에러 리포트

## 요약
전체 코드베이스 (web/, server/, edge-worker/) 분석 결과, 주로 TypeScript 타입 에러와 에러 처리 누락이 발견되었습니다.

---

## 1. LSP Diagnostics 결과

### web/ (6개 파일 스캔)
- **총 에러**: 0
- **총 경고**: 4
- **총 힌트**: 0

#### 경고 상세
| 파일 | 라인 | 경고 내용 | 심각도 |
|------|------|-----------|--------|
| `web/components/FilterModal.tsx` | 24 | Props must be serializable for components in the "use client" entry file, "onClose" is invalid. | WARNING |
| `web/components/FilterModal.tsx` | 27 | Props must be serializable for components in the "use client" entry file, "onToggle" is invalid. | WARNING |
| `web/components/FilterModal.tsx` | 28 | Props must be serializable for components in the "use client" entry file, "onSelectAll" is invalid. | WARNING |
| `web/components/FilterModal.tsx` | 29 | Props must be serializable for components in the "use client" entry file, "onDeselectAll" is invalid. | WARNING |

**원인**: Next.js App Router에서 "use client" 컴포넌트에 함수 props 전달 시 직렬화 문제 발생
**영향도**: 낮음 (런타임 에러 없음, 개발 시 경고만 표시)

---

### server/ (1개 파일 스캔)
- **총 에러**: 16
- **총 경고**: 0
- **총 힌트**: 1

#### 에러 상세
| 파일 | 라인 | 에러 내용 | 심각도 |
|------|------|-----------|--------|
| `server/src/index.ts` | 6 | Cannot find name 'D1Database'. Did you mean 'IDBDatabase'? | ERROR |
| `server/src/index.ts` | 287 | Argument of type 'unknown' is not assignable to parameter of type 'Post'. | ERROR |
| `server/src/index.ts` | 289 | 'post' is of type 'unknown'. | ERROR |
| `server/src/index.ts` | 293 | Spread types may only be created from object types. | ERROR |
| `server/src/index.ts` | 294 | 'post' is of type 'unknown'. | ERROR |
| `server/src/index.ts` | 295 | 'post' is of type 'unknown'. | ERROR |
| `server/src/index.ts` | 302 | 'post' is of type 'unknown'. | ERROR |
| `server/src/index.ts` | 305 | 'post' is of type 'unknown'. | ERROR |
| `server/src/index.ts` | 364 | Cannot find name 'D1Database'. | ERROR |
| `server/src/index.ts` | 421 | Cannot find name 'D1Database'. | ERROR |
| `server/src/index.ts` | 867 | Cannot find name 'D1Database'. | ERROR |
| `server/src/index.ts` | 888 | Cannot find name 'D1Database'. | ERROR |
| `server/src/index.ts` | 1206 | Type 'Cheerio<AnyNode>' is missing properties from type 'CheerioAPI'. | ERROR |
| `server/src/index.ts` | 1235 | Type 'Cheerio<AnyNode>' is not assignable to type 'Cheerio<Element>'. | ERROR |
| `server/src/index.ts` | 1448 | Expected 0 type arguments, but got 1. | ERROR |
| `server/src/index.ts` | 1905 | Property 'find' does not exist on type 'CheerioAPI'. | ERROR |

#### 힌트 상세
| 파일 | 라인 | 힌트 내용 |
|------|------|-----------|
| `server/src/index.ts` | 2078 | 'event' is declared but its value is never read. |

**원인**:
1. `D1Database` 타입 정의 누락 (Cloudflare Workers D1 데이터베이스)
2. `unknown` 타입 문제 (Post 타입 캐스팅 필요)
3. Cheerio 라이브러리 타입 불일치

**영향도**: 높음 (컴파일 실패, 배포 불가)

---

### edge-worker/ (1개 파일 스캔)
- **총 에러**: 0
- **총 경고**: 0
- **총 힌트**: 0

**상태**: 정상

---

## 2. 버그 패턴 스캔 결과

### try-catch 누락
- **발견된 패턴**: 없음
- **분석**: 모든 async 함수에 적절한 에러 처리가 되어 있음

### async/await 누락
- **발견된 패턴**: 없음
- **분석**: Promise 반환 함수 호출 시 대부분 await로 처리됨

### null/undefined 접근
- **발견된 패턴**: 없음
- **분석**: AST 검색 결과 특별한 위험 패턴 발견되지 않음

### 보안 취약점
- **발견된 패턴**: 없음
- **분석**: eval(), new Function(), dangerouslySetInnerHTML 등 보안 위험 패턴 없음

---

## 3. 심층 분석 결과

### web/ 핵심 파일

#### web/app/list/page.tsx
**문제점**:
1. API 호출 실패 시 사용자에게 알리지 않음 (console.error만)
   - 라인 88-89: `catch (err) { console.error("Failed to load posts:", err); }`
   - 사용자에게 에러 메시지 표시 필요

2. IntersectionObserver cleanup 누락 가능성
   - 라인 107-132: useEffect 내에서 observer 생성
   - 의존성 배열에 observer 관련 의존성 없음

#### web/lib/api.ts
**문제점**:
1. 하드코딩된 API 기본 URL (보안 문제)
   - 라인 4: `const FALLBACK_API_BASE_URL = "https://community-aggregator.seomh81.workers.dev";`
   - 프로덕션 환경에서 노출된 URL 사용

2. 디버깅용 agent log 코드 포함
   - 라인 11, 18, 24, 35, 42: fetch 호출로 디버깅 정보 전송
   - 프로덕션 코드에 부적합

### server/ 핵심 파일

#### server/src/index.ts
**문제점**:
1. D1Database 타입 정의 누락
   - Cloudflare Workers D1 데이터베이스 타입 임포트 필요

2. unknown 타입 문제
   - 라인 287: `const detail = await fetchPostDetail(post, c.env);`
   - `post` 변수가 unknown 타입으로 추론됨

3. Cheerio 타입 불일치
   - 라인 1206, 1235: Cheerio 라이브러리 타입 불일치

### edge-worker/ 핵심 파일

#### edge-worker/src/index.ts
**문제점**:
1. fetch 에러 처리 누락
   - 라인 48: `return fetch(upstreamRequest);`
   - try-catch 없이 fetch 호출

### web_fix vs web 차이점

#### web/lib/api.ts vs web_fix/lib/api.ts
**수정된 내용**:
1. 디버깅용 agent log 코드 제거
2. API 기본 URL 변경: `https://community-aggregator.seomh81.workers.dev` → `http://localhost:8787`

**추론**: agent log 코드는 디버깅 목적이었으며, 프로덕션에서는 제거됨

---

## 4. 권장 수정사항

### 우선순위: 높음 (CRITICAL)

1. **server/src/index.ts: D1Database 타입 정의 추가**
   ```typescript
   // Cloudflare Workers D1 타입 임포트 추가
   import { D1Database } from '@cloudflare/workers-types';
   ```

2. **server/src/index.ts: unknown 타입 캐스팅**
   ```typescript
   // 라인 287: Post 타입으로 캐스팅
   const post = await c.env.DB.prepare(
     `SELECT * FROM posts WHERE id = ?`
   ).bind(postId).first<Post>();
   ```

3. **web/lib/api.ts: 하드코딩된 URL 제거**
   ```typescript
   // 환경 변수로 관리되도록 수정
   const FALLBACK_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8787";
   ```

### 우선순위: 중간 (WARNING)

4. **web/app/list/page.tsx: API 에러 사용자 알림 추가**
   ```typescript
   catch (err) {
     console.error("Failed to load posts:", err);
     // 사용자에게 에러 메시지 표시
     setError("게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
   }
   ```

5. **edge-worker/src/index.ts: fetch 에러 처리 추가**
   ```typescript
   try {
     return await fetch(upstreamRequest);
   } catch (err) {
     return json({ success: false, error: "프록시 요청 실패" }, 500);
   }
   ```

### 우선순위: 낮음 (INFO)

6. **web/components/FilterModal.tsx: Props 직렬화 문제 해결**
   - 함수 props 대신 이벤트 핸들러 ID 전달
   - 또는 "use server" 컴포넌트로 변경

---

## 5. 결론

### 총 발견된 이슈
- **에러 (ERROR)**: 16개
- **경고 (WARNING)**: 4개
- **힌트 (INFO)**: 1개

### 주요 문제
1. **타입 정의 누락**: D1Database, Cheerio 타입
2. **에러 처리 누락**: API 호출 실패 시 사용자 알림 부재
3. **보안 문제**: 하드코딩된 API URL, 디버깅용 코드 포함

### 권장 조치
1. 타입 정의 추가 및 수정 (CRITICAL)
2. 에러 처리 개선 (WARNING)
3. 보안 문제 해결 (CRITICAL)
4. 코드 정리 (INFO)

---

**리포트 생성일**: 2026-03-19
**분석 범위**: web/, server/, edge-worker/
**분석 도구**: LSP Diagnostics, ast_grep_search, 수동 코드 검토