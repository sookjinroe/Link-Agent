// ============================================================
// lib.js — 재료 뷰어의 순수 로직. 판정은 만들지 않는다.
//   여기서 파생하는 것은 모두 '신호 관찰'이지 '결정'이 아니다.
//   (표면형 겹침은 충돌 후보 관찰일 뿐, 무엇이 충돌인지 정하지 않는다.)
// ============================================================
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MViewer = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const PALETTE = ["#e8b341", "#6aa9e0", "#b291e6", "#4ec98a", "#e06b5e",
                   "#d98a4a", "#7ec4c4", "#c4a35a", "#9ec46a", "#e08ac4"];
  const HANGUL = /[\uac00-\ud7a3]/;

  function tableName(id) { return id.split(".").slice(0, 2).join("."); }
  function colName(id) { return id.split(".").slice(-1)[0]; }
  function domainOf(id) { return id.split(".")[0]; }

  function domains(G) {
    const seen = [];
    for (const k in G.schema) if (!seen.includes(G.schema[k].schema)) seen.push(G.schema[k].schema);
    return seen;
  }
  function domainColor(G) {
    const map = {};
    domains(G).forEach((d, i) => map[d] = PALETTE[i % PALETTE.length]);
    return (d) => map[d] || "#8b929d";
  }

  function rend(id, G) { return G.render[id] || {}; }
  function psqlOf(id, G) { return (G.psql.per_column || {})[id] || null; }
  function freqOf(id, G) { const p = psqlOf(id, G); return p ? p.analytic_freq : 0; }

  // 표면형: render 표면형 후보 + psql 한글 별칭
  function surfaceForms(id, G) {
    const s = new Set(rend(id, G).surface_candidates || []);
    const p = psqlOf(id, G);
    if (p && p.aliases) for (const a of p.aliases) if (HANGUL.test(a)) s.add(a);
    return [...s];
  }

  // 표면형 겹침 관찰: 같은 표면형이 여러 컬럼/도메인에 등장 (판정 아님)
  function surfaceOverlap(G, minDomains) {
    minDomains = minDomains || 2;
    const s2c = {};
    for (const id in G.render) for (const sf of surfaceForms(id, G)) (s2c[sf] = s2c[sf] || []).push(id);
    const out = {};
    for (const sf in s2c) {
      const doms = new Set(s2c[sf].map(domainOf));
      if (doms.size >= minDomains) out[sf] = s2c[sf];
    }
    return out;
  }

  // 모든 컬럼 id (스키마 순서)
  function allColumns(G) {
    const ids = [];
    for (const k in G.schema) for (const c of G.schema[k].columns) ids.push(k + "." + c.name);
    return ids;
  }

  function tablesByDomain(G) {
    const by = {};
    for (const k in G.schema) (by[G.schema[k].schema] = by[G.schema[k].schema] || []).push(k);
    return by;
  }
  // 나가는 FK: 이 테이블의 FK 컬럼 -> 대상 테이블
  function fkOut(tk, G) {
    const out = [];
    for (const c of (G.schema[tk] ? G.schema[tk].columns : []))
      if (c.fk) out.push({ via: c.name, to: c.fk.split(".").slice(0, 2).join(".") });
    return out;
  }
  // 들어오는 FK: 다른 테이블이 이 테이블을 참조
  function fkIn(tk, G) {
    const inn = [];
    for (const ok in G.schema) if (ok !== tk)
      for (const c of G.schema[ok].columns)
        if (c.fk && c.fk.split(".").slice(0, 2).join(".") === tk) inn.push({ from: ok, via: c.name });
    return inn;
  }

  function searchAll(G, q, cap) {
    cap = cap || 14;
    const nq = (q || "").toLowerCase().replace(/\s+/g, "");
    if (!nq) return [];
    const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, "");
    const out = [];
    for (const id of allColumns(G)) {
      const surf = surfaceForms(id, G).join(" ");
      const desc = rend(id, G).description || "";
      if (norm(id).includes(nq) || norm(surf).includes(nq) || norm(desc).includes(nq))
        out.push({ kind: "column", id, label: colName(id), sub: surf || desc.slice(0, 30) });
    }
    return out.slice(0, cap);
  }

  return { PALETTE, tableName, colName, domainOf, domains, domainColor,
           rend, psqlOf, freqOf, surfaceForms, surfaceOverlap, allColumns,
           tablesByDomain, fkOut, fkIn, searchAll };
});
