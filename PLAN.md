# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: 두 항목 등록, 빈 제목 거절. 이 단계에서 새로고침하면 사라져도 정상이다.
  - 변경 파일: frontend/index.html, frontend/styles.css, frontend/app.js (신규)
  - 실행 명령: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): http.server로 세 파일 모두 200 응답. DOM 스텁(Node)으로 app.js 로직 확인 —
    두 항목 등록·목록 표시, 앞뒤 공백 제거, 빈/공백 제목 거절, 101자 거절·100자 허용,
    HTML 입력은 textContent로 글자 표시, 항목별 고유 id 부여.
  - 남은 확인: 실제 브라우저에서 화면 확인은 아직 하지 않음 (환경에 브라우저 없음). 확인 후 [x] 표시.
- [ ] T02: localStorage(task-flow-v1) 저장·복원.
  확인: 새로고침 후 유지. 손상된 저장값을 자동 덮어쓰지 않는다.
  - 변경 파일: frontend/app.js(저장·복원), frontend/index.html(저장소 경고 영역), frontend/styles.css(경고·비활성 스타일)
  - 실행 명령: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): 세 파일 200 응답. DOM·localStorage 스텁(Node)으로 확인 —
    등록 후 새로고침 시 목록 유지(재등록 후에도 유지, id 고유). 손상값(JSON 깨짐, 배열 아님,
    필드 누락, 빈 제목, id 중복)은 원본 그대로 보존·쓰기 0회, 등록 잠금과 경고 표시.
    setItem 실패 시 항목 추가하지 않고 오류 표시. 저장소 접근 불가 시 경고 후 메모리로만 동작.
    T01 회귀(등록, 빈 제목·101자 거절, 100자 허용) 정상.
  - 남은 확인: 실제 브라우저에서 새로고침 유지와 손상값 경고 화면 확인. 확인 후 [x] 표시.
- [ ] T03: 상태 변경, 수정, 삭제 확인.
  확인: 삭제 취소 시 유지. 다른 항목이 수정되지 않는다.
  - 변경 파일: frontend/app.js(상태·제목 수정·삭제 확인, id 기준 처리), frontend/index.html(목록 오류 영역),
    frontend/styles.css(항목 버튼·완료 표시 스타일)
  - 범위: 수정은 제목만(설명은 T04). status 없는 T02 저장값은 TODO로 읽고, 허용되지 않은 status는 손상값으로 처리.
  - 실행 명령: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): jsdom(scratchpad 설치, 프로젝트 의존성 아님)으로 http.server 페이지를 로드해 22개 항목 통과 —
    기본 상태 TODO, 상태 변경·제목 수정 시 다른 항목 불변, 수정 시 빈 제목·101자 거절, 수정 취소/Escape 유지,
    Enter 저장, 삭제 confirm 취소 시 유지·확인 시 해당 항목만 삭제, 같은 제목 두 항목 중 id로 하나만 변경,
    새로고침 후 결과 유지, T02 데이터 호환, HTML 입력 글자 표시, 빈 제목 등록 거절(회귀), JS 오류 없음.
  - 남은 확인: 실제 브라우저에서 화면 확인. 확인 후 [x] 표시.
- [ ] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: 필터 중 수정·삭제, 어제 마감 TODO의 지연 표시.
  - 변경 파일: frontend/index.html(등록 폼 우선순위·마감일, 검색·필터 영역), frontend/styles.css(배지·지연·수정 폼 스타일),
    frontend/app.js(설명·우선순위·마감일 검증과 저장, 검색·필터 AND, 지연 표시)
  - 범위: 등록 폼은 제목·우선순위·마감일, 수정 폼은 제목·설명·우선순위·마감일. 이전 단계 저장값의 누락 필드는
    기본값(description "", priority NORMAL, due_date null)으로 읽고, 값이 있으나 잘못되면 손상값으로 처리.
    검색·필터 조건은 저장하지 않는다.
  - 실행 명령: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): 세 파일 200 응답. jsdom(scratchpad 설치)으로 T04 39개 항목 통과 —
    등록 기본값, 어제 마감 TODO·DOING 지연 표시 / DONE·오늘·내일·마감 없음은 지연 아님, DONE 전환 시 해제,
    검색+상태+우선순위 AND, 필터 중 수정·삭제(취소 포함) 시 해당 id 항목만 변경, 설명 2000자 허용·2001자 거절,
    마감일 비우면 null, 잘못된 priority·날짜·설명 저장값은 원본 보존·폼 잠금, 설명 HTML 글자 표시, 새로고침 유지.
    T03 회귀 22개 항목 통과, JS 오류 없음.
  - 남은 확인: 실제 브라우저에서 화면 확인. 확인 후 [x] 표시.
## 3장: API
- [ ] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: curl로 200과 status=ok.
- [ ] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
- [ ] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
- [ ] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
## 4장: DB
- [ ] T09: PostgreSQL 전용 사용자·DB와 .env 준비. 접속 확인.
- [ ] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
- [ ] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
## 5장: 서버 분리
- [ ] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
- [ ] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
- [ ] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.