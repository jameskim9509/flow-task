# Task Flow API 명세

## 공통
- 기본 경로: `/api`
- 요청·응답 형식: JSON (`Content-Type: application/json`), 문자 인코딩 UTF-8
- 인증: 없음 (로그인 없는 단일 사용자 앱)
- 저장 방식: 3장은 API 프로세스 메모리(재시작 시 초기화), 4장부터 DB
- 항목 식별: 화면 순번이 아닌 고유 `id`로 수정·삭제한다.

## 데이터: Task
| 필드 | 타입 | 규칙 | 기본값 |
|---|---|---|---|
| id | integer | 서버가 발급, 1부터 증가, 변경 불가 | - |
| title | string | 앞뒤 공백 제거 후 1~100자 | 필수 |
| description | string | 최대 2000자 | `""` |
| status | string | `TODO`, `DOING`, `DONE` | `TODO` |
| priority | string | `HIGH`, `NORMAL`, `LOW` | `NORMAL` |
| due_date | string \| null | `YYYY-MM-DD` 형식의 실제 날짜, 미지정은 `null` | `null` |
| created_at | string | 서버가 발급하는 UTC ISO 8601 일시, 변경 불가 | - |

```json
{
  "id": 1,
  "title": "API 명세 작성",
  "description": "",
  "status": "TODO",
  "priority": "NORMAL",
  "due_date": "2026-10-20",
  "created_at": "2026-10-13T06:00:00Z"
}
```

- 지연 여부는 사용자의 로컬 날짜가 필요하므로 API가 계산하지 않고 화면에서 계산한다.
- 요청 본문에 정의되지 않은 필드(`id`, `created_at` 포함)가 있으면 422로 거절한다.

## 엔드포인트

### GET /api/health
API 동작 확인.
- 200: `{"status": "ok"}`

### GET /api/tasks
할 일 목록을 등록 순서(id 오름차순)로 반환한다.

쿼리 파라미터 (모두 선택, 함께 쓰면 AND 조건):
| 이름 | 설명 |
|---|---|
| q | 제목 부분 일치 검색. 앞뒤 공백 제거, 대소문자 무시. 빈 값이면 검색하지 않음 |
| status | `TODO`, `DOING`, `DONE` 중 하나 |
| priority | `HIGH`, `NORMAL`, `LOW` 중 하나 |

- 200: Task 배열
- 422: status·priority 값이 허용되지 않음

### POST /api/tasks
할 일을 등록한다.

요청 본문:
| 필드 | 필수 | 비고 |
|---|---|---|
| title | O | |
| description | X | |
| status | X | |
| priority | X | |
| due_date | X | `null` 허용 |

```json
{"title": "API 명세 작성", "priority": "HIGH", "due_date": "2026-10-20"}
```

- 201: 등록한 Task
- 422: 입력 규칙 위반 (빈 제목, 101자 제목, 2001자 설명, 허용되지 않은 status·priority, 잘못된 날짜 등)

### PATCH /api/tasks/{id}
전달한 필드만 수정한다. 전달하지 않은 필드는 유지한다.

- 수정 가능 필드: title, description, status, priority, due_date
- `due_date: null`은 마감일 해제. title·description·status·priority에 `null`은 422
- 200: 수정한 Task
- 404: 해당 id 없음 `{"detail": "Task not found"}`
- 422: 입력 규칙 위반

```json
{"status": "DONE"}
```

### DELETE /api/tasks/{id}
할 일을 삭제한다.
- 204: 본문 없음
- 404: 해당 id 없음 `{"detail": "Task not found"}`

## 오류 응답
| 코드 | 의미 | 본문 |
|---|---|---|
| 404 | 대상 없음 | `{"detail": "Task not found"}` |
| 422 | 입력 검증 실패 | FastAPI 기본 형식 `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}` |

## 프런트엔드 연결
- 개발 단계(T08): 화면은 `http://127.0.0.1:5500`, API는 `http://127.0.0.1:8000`에서 실행한다.
  API는 CORS로 화면 주소만 허용한다. 허용 주소는 환경변수 `CORS_ORIGINS`(쉼표 구분)로 바꿀 수 있다.
- 서버 분리 단계(T14): Nginx가 `/api`를 App 서버로 프록시하므로 화면은 같은 주소의 `/api`를 호출한다.
