# 용어집 증강 mock 뷰어

용어집 증강 파이프라인 검증용 mock 데이터셋을 탐색하는 독립 뷰어입니다. 빌드 단계가 없으며 GitHub Pages로 바로 서빙됩니다.

## 뷰

- 개요 — 규모, 도메인, 게이팅 결과, 발견(must인데 못 잡은 컬럼)을 데이터에서 자동 집계
- 구조 — 스키마, 컬럼별 capability 타입, codedict, format, 키
- 컬럼 — 좌측은 전수 목록(티어 뱃지, 통과/탈락/must놓침 필터, no_term 접기, 방향키 ↑↓), 우측은 게이팅 점수 분해(빈도·구조위험·충돌가점 기여)와 그 원천인 Render 산출, P-SQL 신호, 골든
- 충돌 — 충돌 그룹(골든 지정)과 표면형 충돌 표(뷰어 자체 계산)
- 개념 — 직접객체, 포함 하위, 흡수 속성. 상위·하위 트리

## 데이터 견고성

뷰어는 특정 컬럼·개념·도메인 이름에 의존하지 않습니다. `data/`의 네 JSON을 순회해 모든 것을 파생하고, 게이팅과 표면형 충돌은 `lib.js`가 데이터에서 자체 계산합니다. 데이터를 교체하면 도메인 색상, 충돌 그룹, 개념 트리, 게이팅 결과, 발견 목록이 모두 따라 바뀝니다.

## 데이터

- `data/schema.json` 구조 층(테이블, 컬럼, 표준 타입, codedict, format, FK)
- `data/render_output.json` 컬럼별 Render 산출
- `data/psql_output.json` P-SQL 산출(컬럼별, 쌍별, 패턴별)
- `data/golden.json` 골든과 세계진실(개념 구성, 충돌 클러스터, 우선순위 티어)

## 실행

`fetch`로 JSON을 읽으므로 `file://`가 아니라 http 서버로 열어야 합니다.

```
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 을 엽니다. GitHub Pages에서는 그대로 동작합니다.

## 구성

- `index.html` 셸(CDN React 18 + Babel standalone)
- `lib.js` 순수 로직(도메인, 표면형, 충돌 그래프, 게이팅 시뮬레이션). node로도 테스트 가능
- `app.jsx` 뷰
