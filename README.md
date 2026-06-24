# 은행 mock data · 재료 뷰어

실험의 재료가 되는 은행 mock data를 탐색하는 뷰어입니다. 빌드 단계가 없고 GitHub Pages로 서빙됩니다.

## 데이터 성격

이 데이터에는 어떤 판정도 들어 있지 않습니다. 용어 여부·충돌·우선순위 같은 결정은 이 재료 위에서 파이프라인을 돌려 산출하고 분석할 몫입니다.

- `data/schema.json` 테이블·컬럼·타입·PK·FK
- `data/render_output.json` 컬럼별 render 산출(자연어 설명 + type_candidate, risk_flags, surface_candidates, codedict, format, confidence)
- `data/psql_output.json` SQL 로그 분석 신호(빈도·사용역할·리터럴·별칭 / 조인쌍·공동참조·집계패턴)

신호는 컬럼의 종류(kind)에 따라 규칙과 무작위 노이즈로 생성했고 특정 컬럼을 겨냥해 맞추지 않았습니다. 충돌·근접오답은 도메인을 현실대로 채운 결과로 자연 발생한 것이며 의도적으로 심지 않았습니다.

## 뷰

- 개요 — 규모, 도메인, 빈도 분포, capability 후보 분포, 구조 오류위험 플래그 분포
- 구조 — 스키마, 테이블, 컬럼, 타입, 키, 표면형
- Render — 컬럼별 render 산출 전체
- SQL 신호 — 빈도·역할·리터럴·별칭, 조인쌍·공동참조·집계패턴
- 표면형 관찰 — 표면형이 여러 도메인에 겹치는 지점(판정이 아닌 관찰)과 집계 패턴

## 실행

`fetch`로 JSON을 읽으므로 http 서버로 열어야 합니다. `python3 -m http.server 8000`
