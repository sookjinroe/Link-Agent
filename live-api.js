// ============================================================
// live-api.js — Link Agent 모델 호출 래퍼.
//   render·nl2sql 패턴 따름: window.ANTHROPIC_KEY → localStorage 'anthropic_key'.
//   URL 해시 '#k=sk-ant-...'로 키 부트스트랩 (app.jsx에서 처리).
//   window.LinkAPI 로 노출.
// ============================================================
window.LinkAPI = (function () {
  const MODELS = [
    { id: "claude-haiku-4-5",  label: "Haiku 4.5 · 빠름/저렴" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6 · 기본" },
    { id: "claude-opus-4-8",   label: "Opus 4.8 · 고성능" },
  ];
  const DEFAULT_MODEL = "claude-sonnet-4-6";

  function getModel() {
    const m = localStorage.getItem("link_model");
    return MODELS.some((x) => x.id === m) ? m : DEFAULT_MODEL;
  }
  function setModel(id) { localStorage.setItem("link_model", id); }
  function getKey() {
    return (typeof window !== "undefined" && window.ANTHROPIC_KEY) ||
           localStorage.getItem("anthropic_key") || null;
  }
  function setKey(k) { localStorage.setItem("anthropic_key", k); }
  function clearKey() { localStorage.removeItem("anthropic_key"); }
  function hasKey() { return !!getKey(); }

  async function callModel({ system, user, maxTokens }, opts) {
    const { onRetry } = opts || {};
    const headers = { "Content-Type": "application/json" };
    const key = getKey();
    if (!key) throw new Error("API 키가 없습니다 (#k=sk-ant-... 또는 키 입력으로 설정)");
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";

    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", headers,
          body: JSON.stringify({
            model: getModel(),
            max_tokens: maxTokens || 2048,
            temperature: 0,
            system,
            messages: [{ role: "user", content: user }],
          }),
        });
        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
        }
        const data = await resp.json();
        const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
        return text;
      } catch (e) {
        lastErr = e;
        if (e.message && e.message.includes("HTTP 4")) throw e; // 인증·요청 오류는 재시도 안 함
        const delay = 800 * Math.pow(2, attempt - 1);
        if (onRetry) onRetry(attempt, delay, e);
        if (attempt < 3) await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  // JSON 응답 파서 (앞 설명 텍스트 제거, 부분 잘림 복구)
  function parseJSON(text) {
    text = text.trim();
    if (text.startsWith("```")) text = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
    // 배열 또는 객체
    const firstBracket = text.search(/[\[\{]/);
    const lastBracket = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      const jsonPart = text.slice(firstBracket, lastBracket + 1);
      try { return JSON.parse(jsonPart); } catch (e) {
        // 부분 복구
        const lastClose = Math.max(jsonPart.lastIndexOf("}"), jsonPart.lastIndexOf("]"));
        if (lastClose > 0) {
          const closer = jsonPart[0] === "[" ? "]" : "}";
          try { return JSON.parse(jsonPart.slice(0, lastClose + 1) + closer); } catch (e2) {}
        }
      }
    }
    throw new Error("JSON 파싱 실패: " + text.slice(0, 100));
  }

  return { callModel, parseJSON, MODELS, getModel, setModel, getKey, setKey, clearKey, hasKey };
})();

// 시스템 프롬프트 (term producer 1단계 v2, 2단계 군집/보강)
window.LinkPrompts = {
  STAGE1: `너는 시맨틱 레이어의 'Term Producer' 에이전트다. 컬럼 하나에 대해, NL 에이전트가 자연어 질문을 SQL로 풀 때 쓸 term들을 생성한다.

[term이 무엇인가]
term = name + synonyms + links. 자연어 호명을 컬럼과 그 컬럼의 사용법에 잇는다.
- name: 가장 대표적인 호명 (긴 쪽이 보통 변별력이 높다)
- synonyms: 사용자가 부를 만한 모든 변형 (name 포함)
- links: binding을 표현. 한 term이 여러 link를 가질 수 있다.

[link 종류 — 정확히 네 가지]
- value_of(column): 이 개념이 곧 이 컬럼의 값.
- code_value_of(column, value): 개념이 이 컬럼의 특정 코드값으로 실현.
- identified_by(column): entity 개념의 식별 컬럼. PK + capability=entity.
- dated_by(column): 개념의 시점 기준 컬럼. 시간 차원.

[link 결정 규칙]
- PK이고 capability가 entity → identified_by 한 개
- capability가 dimension_time → dated_by 한 개
- codedict가 있으면 → 컬럼 자체 value_of + 각 코드값마다 code_value_of
- 그 외 → value_of 한 개

[표면형·동의어 생성]
- description을 읽고, 이 컬럼이 자연어로 어떻게 호명될지를 뽑는다.
- codedict 라벨을 그대로 name으로 쓰지 마라. 컬럼 컨텍스트로 의미를 살려야 한다.
- 컬럼별로 의미가 다르면 절대 합치지 마라.

[동의어 풍부화의 경계 — 절대 넘지 마라]
(1) 부정형은 부정형 그대로 유지하라.
부정 상태(취소되지 않은, 연체 없는, 미상환)를 긍정 명사구(정상, 완납)로 변환하지 마라. 다른 컬럼의 긍정 의미와 글자가 겹쳐 충돌이 생긴다.

(2) 단독 일반 명사는 동의어 풀에 두지 마라.
짧은 일반 명사는 도메인 한정 없이 들어가면 변별력이 사라진다. 컬럼 맥락이 명시된 형태로만 동의어가 된다.

(3) description에 없는 상위 개념으로 추상화하지 마라.
description이 명시한 의미 범위가 동의어의 경계다.

[출력 — JSON 배열만. 마크다운/펜스/설명 금지]
[
  {"name":"...","synonyms":["...","..."],"links":[{"type":"value_of","column":"..."}]},
  {"name":"...","synonyms":["...","..."],"links":[{"type":"code_value_of","column":"...","value":"..."}]}
]`,

  STAGE2_CLUSTER: `너는 시맨틱 레이어의 2단계 충돌 명시 에이전트다. 한 호명 키를 공유하는 term 군집을 받아, 그 군집 안에서 의미적 충돌을 명시한다.

[입력] 한 호명 키와 그 호명을 포함하는 term들의 군집. 1.5단계 토큰 매칭으로 만들어졌으니 글자만 겹치고 의미는 다른 경우가 섞여 있다. 네가 의미 판단을 한다.

[작업 — 충돌 명시만]
(1) 같은 의미인가 다른 의미인가
- "same_concept_cross_domain": 같은 개념이 도메인 가로질러 등장 (예: "정상 대출"·"정상 카드"·"정상 계좌"가 모두 운영 의미의 "정상")
- "label_collision": 같은 단어가 우연히 다른 의미에서 등장 (예: 운영 의미의 "정상"과 "취소되지 않음"에 든 "정상"은 다른 의미)

(2) 충돌이 없는 경우
- 우연한 토큰 매칭만이면 패치 0개 출력
- 일부만 충돌이면 그 일부에만 명시

[출력 형식 — 엄격]
응답은 첫 글자부터 마지막 글자까지 JSON 배열만이다. 다른 글자는 한 자도 출력하지 마라.
- 설명 텍스트 금지 ("이 군집을 분석합니다" 같은 도입 절대 금지)
- 마크다운 펜스 금지
- 충돌이 없으면 빈 배열 [] 출력
- 응답 첫 글자는 반드시 [ 이다.

[
  {"term_key": "...", "op": "set_ambiguous_with", "value": {"key": "정상", "kind": "same_concept_cross_domain", "with": ["other_term_key1", ...]}}
]`,

  STAGE2_ENRICH: `너는 시맨틱 레이어의 2단계 의미 격차 보강 에이전트다. 한 컬럼의 term들을 받아, 글자 유사도가 낮아 fuzzy 검색이 못 닿는 자연어 변형만 동의어로 추가한다.

[추가 기준 — 다 만족할 때만]
- 사용자가 자연어로 자주 부르는 별칭이고
- 글자 유사도가 낮아 fuzzy로 안 닿고
- description에 등장하지 않으며 1단계 synonyms에도 없는 것

[예시 (적합)]
- "기한이익상실 대출"에 "디폴트 대출", "EOD 대출" 추가
- "VIP 등급 고객"에 "우량 고객" 추가
- "사기 위험 점수"에 "FDS 위험도" 추가

[예시 (부적합 — 추가하지 마라)]
- "연체 대출"에 "연체" 추가 → fuzzy가 잡음
- "예금 잔액"에 "잔액" 추가 → 글자 유사도 높음
- 도메인에서 별개 개념을 동의어로 추가

[출력 — 패치만, JSON 배열. 마크다운/펜스/설명 금지]
[
  {"term_key": "...", "op": "add_synonyms", "value": ["추가 동의어1", ...]}
]

추가가 필요한 term에만 패치. 응답 첫 글자는 [ 이다.`,
};
