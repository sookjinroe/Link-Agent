// ============================================================
// lib.js — 뷰어의 순수 로직 (UI 비의존, node 테스트 가능).
// 원칙: 특정 컬럼/개념/도메인 이름에 의존하지 않는다.
//   데이터(schema/render/psql/golden)를 순회해 모든 것을 파생한다.
//   데이터가 바뀌어도 이 로직은 그대로 동작한다.
// window.GViewer / module.exports 겸용.
// ============================================================
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GViewer = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const PALETTE = ["#e8b341", "#6aa9e0", "#b291e6", "#4ec98a", "#e06b5e",
                   "#d98a4a", "#7ec4c4", "#c4a35a", "#9ec46a", "#e08ac4"];
  const HANGUL = /[\uac00-\ud7a3]/;

  // ---- 도메인 추출 + 색상 (데이터에서) ----
  function domains(G) {
    const seen = [];
    for (const id in G.golden.per_column) {
      const d = (G.golden.per_column[id].world_truth || {}).domain;
      if (d && !seen.includes(d)) seen.push(d);
    }
    return seen;
  }
  function domainColor(G) {
    const map = {};
    domains(G).filter((d) => d !== "TECH").forEach((d, i) => map[d] = PALETTE[i % PALETTE.length]);
    map.TECH = "#5b626c";
    return (d) => map[d] || "#8b929d";
  }

  // ---- 컬럼 메타 헬퍼 ----
  function wt(id, G) { return (G.golden.per_column[id] || {}).world_truth || {}; }
  function gold(id, G) { return G.golden.per_column[id] || {}; }
  function rend(id, G) { return G.render[id] || {}; }
  function psqlOf(id, G) { return (G.psql.per_column || {})[id] || null; }

  // ---- 표면형: render(구조) + psql alias(사용), 한글 업무표현만 ----
  function surfaceForms(id, G) {
    const forms = new Set(rend(id, G).surface_candidates || []);
    const p = psqlOf(id, G);
    if (p && p.aliases) for (const a of p.aliases) if (HANGUL.test(a)) forms.add(a);
    return [...forms];
  }

  // ---- 비즈니스 컬럼 판정 (entity/tech/조인키 제외, 단 개념 직접객체 entity는 포함) ----
  function isBiz(id, G) {
    const w = wt(id, G);
    if (w.role === "tech" || w.role === "identifier") return false;
    if (w.std_type === "entity" && w.role !== "direct") return false;
    return true;
  }

  // ---- 표면형 충돌 그래프: 같은 표면형을 2+ 개념이 공유 ----
  function collisionGraph(G) {
    const s2c = {};
    for (const id in G.golden.per_column) {
      if (!isBiz(id, G)) continue;
      for (const f of surfaceForms(id, G)) (s2c[f] = s2c[f] || []).push(id);
    }
    const collisions = {};
    for (const f in s2c) {
      const concepts = new Set(s2c[f].map((id) => wt(id, G).concept));
      if (concepts.size >= 2) collisions[f] = s2c[f];
    }
    return { surfaceToCols: s2c, collisions };
  }

  // ---- 게이팅 점수: 빈도 + 구조위험 + 약한 충돌가점 ----
  function gatingScore(id, G, inCollision) {
    const p = psqlOf(id, G);
    const freq = p ? p.analytic_freq : 0;
    const freqScore = Math.min(freq / 100, 5);
    const riskScore = (rend(id, G).risk_flags || []).length * 2;
    return freqScore + riskScore + (inCollision ? 1 : 0);
  }

  function tierOf(id, G) {
    // golden에 있으면 사용, 없으면 규칙으로 재계산 (데이터 견고성)
    const g = gold(id, G);
    if (g.priority_tier) return g.priority_tier;
    const v = g.verdict;
    if (v === "no_term") return "no_term";
    if (v === "absorb") return "absorb";
    if (v === "escalate_human") return "human";
    const freq = psqlOf(id, G) ? psqlOf(id, G).analytic_freq : 0;
    const gr = String(g.gate_reason || "");
    if (g.collision_group || (rend(id, G).risk_flags || []).includes("code_value_weak")
        || freq >= 200 || gr.includes("regulatory") || gr.includes("parent")) return "must";
    return "nice";
  }

  // ---- 게이팅 시뮬레이션 ----
  function simulateGating(G, threshold) {
    threshold = threshold == null ? 2 : threshold;
    const { collisions } = collisionGraph(G);
    const inCol = {};
    for (const f in collisions) for (const id of collisions[f]) (inCol[id] = inCol[id] || new Set()).add(f);

    const biz = Object.keys(G.golden.per_column).filter((id) => isBiz(id, G));
    const scores = {}, passed = new Set();
    for (const id of biz) {
      const sc = gatingScore(id, G, !!inCol[id]);
      scores[id] = sc;
      if (sc >= threshold) passed.add(id);
    }
    const pulled = new Set();
    for (const id of [...passed]) {
      if (inCol[id]) for (const f of inCol[id]) for (const m of collisions[f])
        if (!passed.has(m) && isBiz(m, G)) pulled.add(m);
    }
    const gated = new Set([...passed, ...pulled]);

    // must 인데 놓친 것 = 발견 (데이터에서 자동 검출)
    const mustMissed = biz.filter((id) => tierOf(id, G) === "must" && !gated.has(id));
    const noTermFp = biz.filter((id) => tierOf(id, G) === "no_term" && gated.has(id));
    return { gated, passed, pulled, scores, inCol, biz, threshold, mustMissed, noTermFp };
  }

  // ---- 개념 트리: contained_by 로 상위·하위 묶기 ----
  function conceptTree(G) {
    const concepts = G.golden.concepts || {};
    const children = {};  // parentConceptId -> [childConceptId]
    for (const id in G.golden.per_column) {
      const g = G.golden.per_column[id];
      if (g.contained_by) (children[g.contained_by] = children[g.contained_by] || []).push(g.concept_id);
    }
    // 중복 제거
    for (const k in children) children[k] = [...new Set(children[k])];
    const childSet = new Set();
    Object.values(children).forEach((arr) => arr.forEach((c) => childSet.add(c)));
    const roots = Object.keys(concepts).filter((c) => !childSet.has(c));
    return { concepts, children, roots };
  }

  // ---- 개념의 대표 용어명(표면형). 개념 id 대신 사람이 읽는 이름을 보여주기 위함 ----
  function conceptLabel(cid, G) {
    const c = (G.golden.concepts || {})[cid] || {};
    for (const id of (c.direct || [])) { const s = gold(id, G).surface; if (s) return s; }
    if (c.surfaces && c.surfaces.length) return c.surfaces[0];
    return cid;
  }

  // ---- 통합 검색 ----
  function searchAll(G, q, cap) {
    cap = cap || 14;
    const nq = (q || "").toLowerCase().replace(/\s+/g, "");
    if (!nq) return [];
    const out = [];
    const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, "");
    for (const id in G.golden.per_column) {
      const w = wt(id, G), surf = surfaceForms(id, G).join(" ");
      if (norm(id).includes(nq) || norm(w.concept).includes(nq) || norm(surf).includes(nq))
        out.push({ kind: "column", id, label: id.split(".").slice(-1)[0], sub: w.concept || "" });
    }
    for (const cid in (G.golden.concepts || {})) {
      if (norm(cid).includes(nq) || (G.golden.concepts[cid].surfaces || []).some((s) => norm(s).includes(nq)))
        out.push({ kind: "concept", id: cid, label: cid, sub: (G.golden.concepts[cid].surfaces || []).join(", ") });
    }
    for (const grp in (G.golden.collision_clusters || {})) {
      if (norm(grp).includes(nq)) out.push({ kind: "collision", id: grp, label: grp, sub: "충돌 그룹" });
    }
    return out.slice(0, cap);
  }

  return {
    PALETTE, domains, domainColor, wt, gold, rend, psqlOf,
    surfaceForms, isBiz, collisionGraph, gatingScore, tierOf,
    simulateGating, conceptTree, conceptLabel, searchAll,
  };
});
