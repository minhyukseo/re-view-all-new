# 보안 이슈 리포트

## 요약
보안 취약점 패턴 스캔 결과 직접적인 보안 취약점은 발견되지 않았으나, 코드에 몇 가지 보안 관련 이슈가 있습니다.

---

## 1. 하드코딩된 API URL (중간 우선순위)

### 파일: web/lib/api.ts
**라인**: 4

```typescript
const FALLBACK_API_BASE_URL = "https://community-aggregator.seomh81.workers.dev";
```

**문제점**:
- 프로덕션 API URL이 소스 코드에 하드코딩되어 있음
- API 서버 주소가 노출됨
- 환경에 따라 변경이 어려움

**영향도**: 중간
- API 서버 주소 노출
- 보안 그룹/방화벽 정책 적용 어려움

**권장 조치**:
```typescript
// 환경 변수로 관리
const FALLBACK_API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8787";
```

**참고**: web_fix/lib/api.ts에서는 로컬 개발용 URL로 수정됨

---

## 2. 디버깅용 코드 포함 (낮은 우선순위)

### 파일: web/lib/api.ts
**라인**: 11, 18, 24, 35, 42

```typescript
// #region agent log
fetch('http://127.0.0.1:7427/ingest/7dc301c8-a759-417f-be9a-9d4b24a66955', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ad916b' },
  body: JSON.stringify({
    sessionId: 'ad916b',
    runId: 'pre-fix',
    hypothesisId: 'A',
    location: 'web/lib/api.ts:7',
    message: 'Using configured API base URL',
    data: { hasWindow: typeof window !== 'undefined', baseUrl: String(configuredBaseUrl) },
    timestamp: Date.now()
  })
}).catch(() => {});
// #endregion agent log
```

**문제점**:
- 디버깅 목적으로 외부 서버로 데이터 전송
- 사용자 개인정보/환경 정보 노출 가능성
- 프로덕션 코드에 부적합

**영향도**: 낮음
- 현재는 로컬 개발용 서버로 전송
- 하지만 프로덕션 배포 시 제거 필요

**권장 조치**:
- 프로덕션 빌드 시 디버깅 코드 제거
- 또는 조건부 실행 (개발 환경에서만 실행)

---

## 3. fetch 에러 처리 누락 (낮은 우선순위)

### 파일: edge-worker/src/index.ts
**라인**: 48

```typescript
return fetch(upstreamRequest);
```

**문제점**:
- fetch 호출 시 에러 처리 누락
- 네트워크 실패 시 예외 발생 가능

**영향도**: 낮음
- 워커 실행 중 예외 발생 시 전체 요청 실패

**권장 조치**:
```typescript
try {
  return await fetch(upstreamRequest);
} catch (err) {
  return json({ success: false, error: "프록시 요청 실패" }, 500);
}
```

---

## 4. API 에러 응답 노출 (낮은 우선순위)

### 파일: server/src/index.ts
**라인**: 158

```typescript
return c.json({ success: false, error: error.message }, 500);
```

**문제점**:
- 서버 내부 에러 메시지를 그대로 노출
- 스택 트레이스 등 민감한 정보 노출 가능성

**영향도**: 낮음
- 개발 환경에서는 유용하지만 프로덕션에서는 보안 문제

**권장 조치**:
```typescript
// 개발 환경에서는 자세한 에러 메시지, 프로덕션에서는 일반 메시지
if (env.ENVIRONMENT === 'development') {
  return c.json({ success: false, error: error.message }, 500);
} else {
  return c.json({ success: false, error: 'Internal server error' }, 500);
}
```

---

## 5. 보안 취약점 패턴 스캔 결과

### 스캔 항목
1. `eval()` 사용: 없음
2. `new Function()` 사용: 없음
3. `innerHTML` 사용: 없음
4. `dangerouslySetInnerHTML` 사용: 없음
5. 하드코딩된 credential/secret: 없음
6. SQL 문자열拼接: 없음

**결과**: 직접적인 보안 취약점 패턴 발견되지 않음

---

## 결론

### 보안 이슈 요약
| 우선순위 | 이슈 | 파일 | 영향도 |
|----------|------|------|--------|
| 중간 | 하드코딩된 API URL | web/lib/api.ts | API 서버 주소 노출 |
| 낮음 | 디버깅용 코드 포함 | web/lib/api.ts | 개인정보 노출 가능성 |
| 낮음 | fetch 에러 처리 누락 | edge-worker/src/index.ts | 네트워크 실패 시 예외 |
| 낮음 | API 에러 응답 노출 | server/src/index.ts | 민감한 정보 노출 |

### 권장 조치
1. **즉시 수정**: 하드코딩된 API URL 제거 (환경 변수로 관리)
2. **배포 전 수정**: 디버깅용 코드 제거
3. **개선 필요**: 에러 처리 추가 및 에러 응답 개선

---

**리포트 생성일**: 2026-03-19
**분석 범위**: web/, server/, edge-worker/
**분석 도구**: ast_grep_search, 수동 코드 검토