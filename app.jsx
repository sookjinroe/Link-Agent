// ============================================================
// app.jsx — 용어집 증강 mock 뷰어.
// 모든 뷰는 데이터(schema/render/psql/golden)를 순회해 렌더한다.
// 특정 컬럼·개념·도메인 이름에 의존하지 않으므로 데이터가 바뀌어도 동작한다.
// 게이팅·충돌은 lib.js(GViewer)가 데이터에서 자체 계산한다.
// ============================================================
const { useState, useEffect, useRef, useMemo } = React;
const L = window.GViewer;
const mono = { fontFamily: "var(--mono)" };

// ---- 코드값 라벨/색 (없는 값은 fallback) ----
const VERDICT_LABEL = {
  direct_object: "직접객체", separate: "별개", separate_collision: "별개+충돌",
  absorb: "흡수", contains: "포함", escalate_human: "사람비준", no_term: "용어불필요",
};
const VERDICT_COLOR = {
  direct_object: "var(--accent)", separate: "var(--sig)", separate_collision: "var(--low)",
  absorb: "var(--lin)", contains: "var(--high)", escalate_human: "var(--med)", no_term: "var(--dim)",
};
const TIER_LABEL = { must: "must", nice: "nice", absorb: "absorb", human: "human", no_term: "no_term" };
const TIER_COLOR = { must: "var(--low)", nice: "var(--sig)", absorb: "var(--lin)", human: "var(--med)", no_term: "var(--dim)" };
const RISK_LABEL = { code_value_weak: "코드값 약함", format_trap: "형식 함정", near_confusion: "근접 혼동" };
const RISK_COLOR = { code_value_weak: "var(--low)", format_trap: "var(--med)", near_confusion: "var(--accent)" };
const STD_LABEL = { entity: "entity", dimension_categorical: "categorical", dimension_time: "time", measure: "measure" };
const ROLE_LABEL = { identifier: "식별자", direct: "직접", attribute: "속성", date: "기준일", sub: "하위", tech: "기술" };

// ===================== 공통 컴포넌트 =====================
function Center({ children }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", color: "var(--muted)", fontSize: 16 }}>{children}</div>;
}
function TwoPane({ left, right }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: "calc(100vh - 92px)" }}>
      <div style={{ borderRight: "1px solid var(--border)", padding: "14px", overflowY: "auto", maxHeight: "calc(100vh - 92px)" }}>{left}</div>
      <div style={{ padding: "18px 26px", overflowY: "auto", maxHeight: "calc(100vh - 92px)" }}>{right}</div>
    </div>);
}
function Section({ title, children, note }) {
  return (<div style={{ marginTop: 22 }}>
    <div style={{ ...mono, fontSize: 13, letterSpacing: "0.05em", color: "var(--muted)", marginBottom: note ? 4 : 9 }}>{title}</div>
    {note && <div style={{ fontSize: 13.5, color: "var(--dim)", marginBottom: 10, lineHeight: 1.6 }}>{note}</div>}
    {children}</div>);
}
function Chip({ color, children, onClick, title }) {
  return <span title={title} onClick={onClick} style={{
    ...mono, fontSize: 13, color: color || "var(--text)", border: `1px solid ${(color || "var(--border)")}66`,
    borderRadius: 4, padding: "2px 9px", marginRight: 6, marginBottom: 5, display: "inline-block",
    cursor: onClick ? "pointer" : "default" }}>{children}</span>;
}
function Badge({ color, children, onClick }) {
  return <span onClick={onClick} style={{
    ...mono, fontSize: 11.5, color: color || "var(--dim)", border: `1px solid ${(color || "var(--dim)")}55`,
    borderRadius: 4, padding: "0px 6px", marginLeft: 5, whiteSpace: "nowrap", display: "inline-block",
    marginBottom: 2, cursor: onClick ? "pointer" : "default" }}>{children}</span>;
}
function HoverRow({ active, onClick, children, style }) {
  const [h, setH] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (active && ref.current && ref.current.scrollIntoView) ref.current.scrollIntoView({ block: "nearest" }); }, [active]);
  const bg = active ? "rgba(255,255,255,0.07)" : (h ? "rgba(255,255,255,0.035)" : "transparent");
  return <div ref={ref} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{ ...style, background: bg, transition: "background .12s", cursor: "pointer" }}>{children}</div>;
}

// 목록형 뷰의 ↑↓ 방향키 탐색. orderedIds 순서로 현재 sel을 ±1 이동시켜 onPick 호출.
// 전역 검색 input(data-search="global")에 포커스가 있을 때는 무시한다.
function useListNav(orderedIds, sel, onPick, active) {
  const key = orderedIds.join("|");
  useEffect(() => {
    if (active === false) return;
    function onKey(e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (e.target && e.target.dataset && e.target.dataset.search === "global") return;
      if (!orderedIds.length) return;
      e.preventDefault();
      const i = orderedIds.indexOf(sel);
      let ni;
      if (i < 0) ni = 0;
      else ni = e.key === "ArrowDown" ? Math.min(orderedIds.length - 1, i + 1) : Math.max(0, i - 1);
      if (orderedIds[ni] && orderedIds[ni] !== sel) onPick(orderedIds[ni]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, sel, active]);
}
function Bar({ value, max, color, w }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: "inline-block", width: w || 120, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 3, verticalAlign: "middle" }}>
      <div style={{ width: pct + "%", height: "100%", background: color || "var(--sig)", borderRadius: 3 }} />
    </div>);
}
function Stat({ label, value, color }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 7, padding: "12px 16px", minWidth: 110 }}>
      <div style={{ ...mono, fontSize: 26, color: color || "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>);
}
function colName(id) { return id.split(".").slice(-1)[0]; }
function tableName(id) { return id.split(".").slice(0, 2).join("."); }

// ===================== 검색 =====================
function SearchBox({ G, nav }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const results = q ? L.searchAll(G, q) : [];
  const KIND = { column: ["C", "var(--sig)"], concept: ["개념", "var(--accent)"], collision: ["충돌", "var(--low)"] };
  function go(r) {
    setOpen(false); setQ("");
    if (r.kind === "column") nav("schema", tableName(r.id), r.id);
    else if (r.kind === "concept") nav("concept", r.id);
    else nav("collision", r.id);
  }
  return (
    <div style={{ position: "relative" }}>
      <input value={q} placeholder="컬럼·개념·충돌 검색" data-search="global" onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && results.length) go(results[0]); if (e.key === "Escape") setOpen(false); }}
        style={{ ...mono, fontSize: 14, width: 240, background: "rgba(0,0,0,0.3)", color: "var(--text)",
          border: "1px solid var(--border)", borderRadius: 4, padding: "5px 10px" }} />
      {open && results.length > 0 &&
        <div style={{ position: "absolute", top: "112%", right: 0, width: 400, zIndex: 50, background: "var(--panel)",
          border: "1px solid var(--border)", borderRadius: 6, maxHeight: 360, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {results.map((r, i) =>
            <div key={i} onClick={() => go(r)} style={{ display: "flex", gap: 9, padding: "7px 12px", cursor: "pointer",
              alignItems: "baseline", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ ...mono, fontSize: 11, color: KIND[r.kind][1], width: 30, flexShrink: 0 }}>{KIND[r.kind][0]}</span>
              <span style={{ ...mono, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap" }}>{r.label}</span>
              <span style={{ fontSize: 13, color: "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</span>
            </div>)}
        </div>}
    </div>);
}

// ===================== ① 개요 =====================
function Overview({ G, nav }) {
  const dc = L.domainColor(G);
  const cols = Object.keys(G.golden.per_column);
  const tables = Object.keys(G.schema);
  const doms = L.domains(G).filter((d) => d !== "TECH");
  const sim = L.simulateGating(G);
  const metrics = (G.psql.agg_patterns || []);
  // verdict 분포
  const vc = {};
  cols.forEach((id) => { const v = G.golden.per_column[id].verdict; vc[v] = (vc[v] || 0) + 1; });
  // tier 분포 (비즈니스)
  const tc = {};
  sim.biz.forEach((id) => { const t = L.tierOf(id, G); tc[t] = (tc[t] || 0) + 1; });
  const clusters = G.golden.collision_clusters || {};

  return (
    <div style={{ padding: "22px 30px", maxWidth: 1080 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <Stat label="테이블" value={tables.length} />
        <Stat label="컬럼" value={cols.length} />
        <Stat label="도메인" value={doms.length} />
        <Stat label="metric" value={metrics.length} color="var(--lin)" />
        <Stat label="충돌 그룹" value={Object.keys(clusters).length} color="var(--low)" />
      </div>

      <Section title="도메인" note="세계진실의 업무 도메인. 색은 데이터에서 자동 할당됩니다.">
        <div>{doms.map((d) => <Chip key={d} color={dc(d)} onClick={() => nav("schema")}>{d}</Chip>)}</div>
      </Section>

      <Section title="게이팅 결과" note="빈도 + 구조 오류위험 + 약한 충돌가점으로 용어 분석 대상을 선별합니다. 충돌은 클러스터로 끌어옵니다.">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat label="비즈니스 컬럼" value={sim.biz.length} />
          <Stat label="게이팅 통과" value={sim.gated.size} color="var(--high)" />
          <Stat label="1차 통과" value={sim.passed.size} />
          <Stat label="클러스터 끌어옴" value={sim.pulled.size} color="var(--accent)" />
        </div>
        <div style={{ marginTop: 14 }}>
          {["must", "nice", "absorb", "human", "no_term"].map((t) => tc[t] ? (
            <span key={t} style={{ marginRight: 16 }}>
              <Badge color={TIER_COLOR[t]}>{TIER_LABEL[t] || t}</Badge>
              <span style={{ ...mono, fontSize: 13.5, color: "var(--muted)", marginLeft: 4 }}>{tc[t]}</span>
            </span>) : null)}
        </div>
      </Section>

      <Section title={`발견 — must 인데 게이팅이 못 잡은 컬럼 (데이터에서 자동 검출)`}
        note="빈도·구조·충돌 신호로는 잡히지 않는 must. 데이터가 바뀌면 이 목록도 따라 바뀝니다.">
        {sim.mustMissed.length === 0
          ? <div style={{ ...mono, fontSize: 14, color: "var(--high)" }}>없음 — 모든 must 통과</div>
          : sim.mustMissed.map((id) => {
            const g = G.golden.per_column[id];
            return (
              <div key={id} style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--low)",
                borderRadius: 6, padding: "10px 14px", marginBottom: 8 }}>
                <span style={{ ...mono, fontSize: 14.5, color: "var(--text)", cursor: "pointer" }}
                  onClick={() => nav("gating", id)}>{colName(id)}</span>
                <Badge color={dc(L.wt(id, G).domain)}>{L.wt(id, G).domain}</Badge>
                <span style={{ ...mono, fontSize: 12.5, color: "var(--dim)", marginLeft: 8 }}>
                  freq={L.psqlOf(id, G) ? L.psqlOf(id, G).analytic_freq : 0} · score={(sim.scores[id] || 0).toFixed(1)}
                </span>
                {g.note && <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.55 }}>{g.note}</div>}
              </div>);
          })}
        <div style={{ ...mono, fontSize: 12.5, color: "var(--dim)", marginTop: 6 }}>
          no_term 잘못 통과(FP): {sim.noTermFp.length}
        </div>
      </Section>

      <Section title="모으고 가르기 판정 분포">
        <div>{Object.entries(vc).sort((a, b) => b[1] - a[1]).map(([v, n]) =>
          <span key={v} style={{ marginRight: 16 }}>
            <Badge color={VERDICT_COLOR[v]}>{VERDICT_LABEL[v] || v}</Badge>
            <span style={{ ...mono, fontSize: 13.5, color: "var(--muted)", marginLeft: 4 }}>{n}</span>
          </span>)}</div>
      </Section>
    </div>);
}

// ===================== ② 구조 =====================
function SchemaView({ G, route, nav }) {
  const dc = L.domainColor(G);
  const tables = Object.keys(G.schema);
  // 도메인별 테이블 그룹 (테이블의 첫 컬럼 도메인으로)
  const tableDomain = (tk) => {
    const c = G.schema[tk].columns.find((c) => {
      const w = L.wt(tk + "." + c.name, G); return w.domain && w.domain !== "TECH";
    });
    return c ? L.wt(tk + "." + c.name, G).domain : "기타";
  };
  const byDom = {};
  tables.forEach((tk) => { const d = tableDomain(tk); (byDom[d] = byDom[d] || []).push(tk); });
  const sel = route.sel && G.schema[route.sel] ? route.sel : tables[0];
  useListNav(Object.values(byDom).flat(), sel, (tk) => nav("schema", tk), true);

  const left = Object.entries(byDom).map(([d, tks]) => (
    <div key={d} style={{ marginBottom: 12 }}>
      <div style={{ ...mono, fontSize: 13, letterSpacing: "0.05em", color: dc(d), marginBottom: 5 }}>{d}</div>
      {tks.map((tk) => (
        <HoverRow key={tk} active={sel === tk} onClick={() => nav("schema", tk)}
          style={{ padding: "4px 8px", borderRadius: 4 }}>
          <span style={{ ...mono, fontSize: 13.5, color: "var(--text)" }}>{G.schema[tk].table}</span>
          <span style={{ ...mono, fontSize: 11.5, color: "var(--dim)", marginLeft: 6 }}>{G.schema[tk].columns.length}</span>
        </HoverRow>))}
    </div>));

  const t = G.schema[sel];
  const right = (
    <div style={{ maxWidth: 920 }}>
      <div style={{ ...mono, fontSize: 19, color: "var(--text)" }}>{t.table}</div>
      <div style={{ ...mono, fontSize: 13, color: "var(--dim)", marginTop: 3 }}>{t.schema}</div>
      <Section title="컬럼">
        <table style={{ ...mono, fontSize: 13, width: "100%" }}>
          <thead><tr style={{ color: "var(--muted)", textAlign: "left" }}>
            {["컬럼", "타입", "capability", "codedict", "format", "키"].map((h) =>
              <th key={h} style={{ padding: "4px 12px 8px 0", borderBottom: "1px solid var(--border)", fontWeight: 400 }}>{h}</th>)}
          </tr></thead>
          <tbody>{t.columns.map((c) => {
            const id = sel + "." + c.name;
            const hl = route.hl === id;
            return (
              <tr key={c.name} style={{ background: hl ? "rgba(232,179,65,0.08)" : "transparent" }}>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--text)", cursor: "pointer" }}
                  onClick={() => nav("render", id)}>{c.name}</td>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--dim)" }}>{c.dtype}</td>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--sig)" }}>{STD_LABEL[c.std_type] || c.std_type}</td>
                <td style={{ padding: "5px 12px 5px 0", color: c.codedict ? "var(--high)" : "var(--dim)" }}>
                  {c.codedict ? Object.keys(c.codedict).length + "개" : (/(_CD|_YN|_FLG)$/.test(c.name) ? "결손" : "-")}</td>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--lin)" }}>{c.format || "-"}</td>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--accent)" }}>{c.pk ? "PK" : c.fk ? "FK" : ""}</td>
              </tr>);
          })}</tbody>
        </table>
      </Section>
    </div>);
  return <TwoPane left={left} right={right} />;
}

// ===================== 컬럼 리스트 좌측 (Render/P-SQL 공용) =====================
function ColumnList({ G, sel, onPick, filter }) {
  const dc = L.domainColor(G);
  const [q, setQ] = useState("");
  let cols = Object.keys(G.golden.per_column);
  if (filter) cols = cols.filter(filter);
  if (q) cols = cols.filter((id) => (id + (L.wt(id, G).concept || "")).toLowerCase().includes(q.toLowerCase()));
  useListNav(cols, sel, onPick, true);
  // 테이블별 그룹
  const byTable = {};
  cols.forEach((id) => { const t = tableName(id); (byTable[t] = byTable[t] || []).push(id); });
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="컬럼 필터"
        style={{ ...mono, fontSize: 13, width: "100%", background: "rgba(0,0,0,0.3)", color: "var(--text)",
          border: "1px solid var(--border)", borderRadius: 4, padding: "5px 9px", marginBottom: 10 }} />
      {Object.entries(byTable).map(([t, ids]) => (
        <div key={t} style={{ marginBottom: 10 }}>
          <div style={{ ...mono, fontSize: 11.5, color: "var(--dim)", marginBottom: 3 }}>{G.schema[t] ? G.schema[t].table : t}</div>
          {ids.map((id) => (
            <HoverRow key={id} active={sel === id} onClick={() => onPick(id)} style={{ padding: "3px 8px", borderRadius: 4 }}>
              <span style={{ ...mono, fontSize: 13, color: "var(--text)" }}>{colName(id)}</span>
            </HoverRow>))}
        </div>))}
    </div>);
}

// ===================== ③ Render 산출 =====================
function RenderView({ G, route, nav }) {
  const dc = L.domainColor(G);
  const first = Object.keys(G.golden.per_column)[0];
  const sel = route.sel && G.render[route.sel] ? route.sel : first;
  const r = L.rend(sel, G), w = L.wt(sel, G);
  const right = (
    <div style={{ maxWidth: 820 }}>
      <div style={{ ...mono, fontSize: 18, color: "var(--text)" }}>{colName(sel)}
        <Badge color={dc(w.domain)}>{w.domain}</Badge></div>
      <div style={{ ...mono, fontSize: 12.5, color: "var(--dim)", marginTop: 3 }}>{sel}</div>

      <Section title="description">
        <div style={{ fontSize: 15, color: "var(--text)", lineHeight: 1.7 }}>{r.description || "-"}</div>
      </Section>
      <Section title="type_candidate (capability 후보)">
        <div>{(r.type_candidate || []).map((t) => <Chip key={t} color="var(--sig)">{STD_LABEL[t] || t}</Chip>)}
          {(r.type_candidate || []).length > 1 && <span style={{ fontSize: 13, color: "var(--med)", marginLeft: 6 }}>다용도</span>}</div>
      </Section>
      {r.risk_flags && r.risk_flags.length > 0 &&
        <Section title="오류위험 플래그">
          <div>{r.risk_flags.map((f) => <Chip key={f} color={RISK_COLOR[f]}>{RISK_LABEL[f] || f}</Chip>)}</div>
        </Section>}
      <Section title="surface_candidates (구조에서 뽑은 표면형)">
        <div>{(r.surface_candidates || []).length
          ? r.surface_candidates.map((s) => <Chip key={s}>{s}</Chip>)
          : <span style={{ color: "var(--dim)" }}>-</span>}</div>
      </Section>
      {r.codedict &&
        <Section title="codedict">
          <table style={{ ...mono, fontSize: 13 }}><tbody>
            {Object.entries(r.codedict).map(([k, v]) =>
              <tr key={k}><td style={{ color: "var(--accent)", padding: "2px 14px 2px 0" }}>{k}</td>
                <td style={{ color: "var(--text)" }}>{v}</td></tr>)}
          </tbody></table>
        </Section>}
      <Section title="기타">
        <div style={{ ...mono, fontSize: 13.5, color: "var(--muted)" }}>
          format: <span style={{ color: "var(--lin)" }}>{r.format || "-"}</span>
          <span style={{ marginLeft: 18 }}>confidence: <span style={{ color: "var(--text)" }}>{r.confidence || "-"}</span></span>
        </div>
      </Section>
    </div>);
  return <TwoPane left={<ColumnList G={G} sel={sel} onPick={(id) => nav("render", id)} />} right={right} />;
}

// ===================== ④ P-SQL 신호 =====================
function PsqlView({ G, route, nav }) {
  const first = Object.keys(G.golden.per_column)[0];
  const sel = route.sel && G.golden.per_column[route.sel] ? route.sel : first;
  const p = L.psqlOf(sel, G);
  const roleMax = p ? Math.max(1, ...Object.values(p.usage_roles || {})) : 1;
  const joinPairs = (G.psql.join_pairs || []).filter((x) => x.a === sel || x.b === sel);
  const cooc = (G.psql.cooccur || []).filter((x) => x.a === sel || x.b === sel).sort((a, b) => b.cooccur_freq - a.cooccur_freq).slice(0, 8);

  const right = (
    <div style={{ maxWidth: 820 }}>
      <div style={{ ...mono, fontSize: 18, color: "var(--text)" }}>{colName(sel)}</div>
      <div style={{ ...mono, fontSize: 12.5, color: "var(--dim)", marginTop: 3 }}>{sel}</div>
      {!p ? <Section title="신호"><div style={{ color: "var(--dim)" }}>P-SQL 산출 없음</div></Section> : (
        <>
          <Section title="분석 빈도">
            {p.analytic_freq === 0
              ? <div style={{ ...mono, color: "var(--low)" }}>0 — 신호 없음 (부재이지 부정이 아님)</div>
              : <span style={{ ...mono, fontSize: 22, color: "var(--text)" }}>{p.analytic_freq}</span>}
          </Section>
          <Section title="사용 역할 (타입 확증, 강화 전용)">
            <table style={{ ...mono, fontSize: 13 }}><tbody>
              {Object.entries(p.usage_roles || {}).map(([k, v]) =>
                <tr key={k}><td style={{ color: "var(--muted)", padding: "3px 14px 3px 0", width: 70 }}>{k}</td>
                  <td style={{ padding: "3px 10px 3px 0" }}><Bar value={v} max={roleMax} /></td>
                  <td style={{ color: "var(--text)" }}>{v}</td></tr>)}
            </tbody></table>
          </Section>
          <Section title="where 리터럴 (값 binding 후보)">
            <div>{(p.where_literals || []).length ? p.where_literals.map((x) => <Chip key={x} color="var(--accent)">{x}</Chip>)
              : <span style={{ color: "var(--dim)" }}>-</span>}</div>
          </Section>
          <Section title="별칭 (사용에서 온 표면형)">
            <div>{(p.aliases || []).length ? p.aliases.map((x) => <Chip key={x}>{x}</Chip>)
              : <span style={{ color: "var(--dim)" }}>-</span>}</div>
          </Section>
        </>)}
      {joinPairs.length > 0 &&
        <Section title="조인 쌍 (entity·미선언 FK 후보)">
          {joinPairs.map((x, i) => <div key={i} style={{ ...mono, fontSize: 13, color: "var(--muted)", marginBottom: 3 }}>
            {colName(x.a)} <span style={{ color: "var(--dim)" }}>↔</span> {x.b} <span style={{ color: "var(--dim)" }}>({x.join_freq})</span></div>)}
        </Section>}
      {cooc.length > 0 &&
        <Section title="공동참조 (개념 경계 신호)">
          {cooc.map((x, i) => { const other = x.a === sel ? x.b : x.a;
            return <div key={i} style={{ ...mono, fontSize: 13, color: "var(--muted)", marginBottom: 3 }}>
              {colName(other)} <span style={{ color: "var(--dim)" }}>({x.cooccur_freq})</span>
              {x.same_concept_hint && <Badge color="var(--high)">동일개념</Badge>}</div>; })}
        </Section>}
    </div>);
  return <TwoPane left={<ColumnList G={G} sel={sel} onPick={(id) => nav("psql", id)} />} right={right} />;
}

// ===================== ⑤ 게이팅 =====================
function GatingView({ G, route, nav }) {
  const dc = L.domainColor(G);
  const sim = L.simulateGating(G);
  const order = ["must", "nice", "absorb", "human", "no_term"];
  const byTier = {};
  sim.biz.forEach((id) => { const t = L.tierOf(id, G); (byTier[t] = byTier[t] || []).push(id); });
  const maxScore = Math.max(1, ...Object.values(sim.scores));

  function row(id) {
    const sc = sim.scores[id] || 0;
    const inGate = sim.gated.has(id);
    const pulled = sim.pulled.has(id);
    const w = L.wt(id, G);
    const hl = route.sel === id;
    return (
      <HoverRow key={id} active={hl} onClick={() => nav("render", id)}
        style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 10px", borderRadius: 4 }}>
        <span style={{ ...mono, fontSize: 13.5, color: inGate ? "var(--text)" : "var(--dim)", width: 180 }}>{colName(id)}</span>
        <Badge color={dc(w.domain)}>{w.domain}</Badge>
        <span style={{ flex: 1 }} />
        <Bar value={sc} max={maxScore} w={90} color={inGate ? "var(--high)" : "var(--dim)"} />
        <span style={{ ...mono, fontSize: 12.5, color: "var(--muted)", width: 34, textAlign: "right" }}>{sc.toFixed(1)}</span>
        {pulled && <Badge color="var(--accent)">클러스터</Badge>}
        {!inGate && <Badge color="var(--low)">탈락</Badge>}
      </HoverRow>);
  }

  return (
    <div style={{ padding: "18px 26px", maxWidth: 1040 }}>
      <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--sig)", borderRadius: 7,
        padding: "13px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7 }}>
          게이팅 점수 = 빈도 + 구조 오류위험 + 약한 충돌가점(+1). 임계 {sim.threshold} 이상이면 1차 통과.
          충돌 표면형 클러스터는 멤버 하나가 통과하면 나머지를 끌어옵니다(저빈도 충돌상대 구제).
          빈도 0은 신호 없음이지 탈락 사유가 아닙니다.
        </div>
        <div style={{ marginTop: 10 }}>
          <Stat label="비즈니스" value={sim.biz.length} /> <span style={{ display: "inline-block", width: 8 }} />
          <span style={{ ...mono, color: "var(--high)" }}>게이팅 {sim.gated.size}</span>
          <span style={{ ...mono, color: "var(--accent)", marginLeft: 16 }}>클러스터 구제 {sim.pulled.size}</span>
          <span style={{ ...mono, color: "var(--low)", marginLeft: 16 }}>must 놓침 {sim.mustMissed.length}</span>
          <span style={{ ...mono, color: "var(--dim)", marginLeft: 16 }}>no_term FP {sim.noTermFp.length}</span>
        </div>
      </div>

      {order.map((t) => byTier[t] && byTier[t].length ? (
        <Section key={t} title={
          <span><Badge color={TIER_COLOR[t]}>{TIER_LABEL[t] || t}</Badge> <span style={{ color: "var(--muted)" }}>{byTier[t].length}</span></span>}>
          {t === "must" && sim.mustMissed.length > 0 &&
            <div style={{ fontSize: 13, color: "var(--low)", marginBottom: 6 }}>
              must 중 탈락(발견): {sim.mustMissed.map(colName).join(", ")}
            </div>}
          {byTier[t].sort((a, b) => (sim.scores[b] || 0) - (sim.scores[a] || 0)).map(row)}
        </Section>) : null)}
    </div>);
}

// ===================== ⑥ 충돌 지도 =====================
function CollisionView({ G, route, nav }) {
  const dc = L.domainColor(G);
  const clusters = G.golden.collision_clusters || {};
  const { collisions } = L.collisionGraph(G);
  const sel = route.sel;

  return (
    <div style={{ padding: "18px 26px", maxWidth: 1040 }}>
      <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--low)", borderRadius: 7,
        padding: "13px 18px", marginBottom: 22 }}>
        <div style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7 }}>
          같은 표면형이 여러 도메인·개념에 걸리는 지점입니다. 충돌 그룹은 골든이 지정한 묶음이고,
          표면형 충돌 표는 뷰어가 데이터에서 자체 계산한 것(render·psql 표면형을 가로질러 비교)입니다.
        </div>
      </div>

      <Section title={`충돌 그룹 — ${Object.keys(clusters).length}군 (골든 지정)`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {Object.entries(clusters).map(([grp, members]) => {
            const surfaces = [...new Set(members.map((m) => m.surface).filter(Boolean))];
            const domsIn = [...new Set(members.map((m) => m.domain))];
            return (
              <div key={grp} style={{ border: `1px solid ${sel === grp ? "var(--med)" : "var(--border)"}`,
                borderRadius: 6, padding: "11px 14px" }}>
                <div style={{ ...mono, fontSize: 14.5, color: "var(--med)", marginBottom: 4 }}>{grp}</div>
                <div style={{ fontSize: 13.5, color: "var(--low)", marginBottom: 6 }}>
                  표면형 "{surfaces.join("·")}" 이 {domsIn.length}개 도메인에 걸침
                </div>
                <div>{members.map((m) =>
                  <Chip key={m.id} color={dc(m.domain)} onClick={() => nav("render", m.id)}
                    title={m.id}>{colName(m.id)} ·{m.domain}</Chip>)}</div>
              </div>);
          })}
        </div>
      </Section>

      <Section title={`표면형 충돌 표 — ${Object.keys(collisions).length}개 (뷰어 자체 계산)`}
        note="같은 표면형이 2개 이상 개념에 닿는 경우. recall 위주로 흡수 속성의 표면형 겹침까지 포함합니다.">
        {Object.entries(collisions).sort((a, b) => b[1].length - a[1].length).map(([word, ids]) => (
          <div key={word} style={{ display: "flex", gap: 12, alignItems: "center", padding: "6px 12px", borderRadius: 5,
            border: `1px solid ${sel === word ? "var(--low)" : "rgba(255,255,255,0.05)"}`, marginBottom: 6 }}>
            <span style={{ ...mono, fontSize: 14.5, color: "var(--low)", width: 110, flexShrink: 0 }}>"{word}"</span>
            <span style={{ ...mono, fontSize: 12, color: "var(--dim)" }}>→</span>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {ids.map((id) => { const w = L.wt(id, G);
                return <Chip key={id} color={dc(w.domain)} onClick={() => nav("render", id)} title={id}>
                  {w.concept || colName(id)} <span style={{ color: "var(--dim)" }}>·{w.domain}</span></Chip>; })}
            </div>
          </div>))}
      </Section>
    </div>);
}

// ===================== ⑦ 개념 구성 =====================
function ConceptView({ G, route, nav }) {
  const dc = L.domainColor(G);
  const { concepts, children, roots } = L.conceptTree(G);
  // 개념 -> 도메인 (구성 컬럼에서)
  const conceptDomain = (cid) => {
    const c = concepts[cid] || {};
    const any = (c.direct || []).concat(c.subs || [], c.absorbed || [])[0];
    return any ? L.wt(any, G).domain : "";
  };
  const sel = route.sel && concepts[route.sel] ? route.sel : roots[0];

  // 좌: 상위(포함 가진) 개념 먼저, 나머지
  const withChildren = roots.filter((c) => children[c]);
  const flat = roots.filter((c) => !children[c]);
  const navOrder = [];
  withChildren.forEach((cid) => { navOrder.push(cid); (children[cid] || []).forEach((ch) => navOrder.push(ch)); });
  flat.forEach((cid) => navOrder.push(cid));
  useListNav(navOrder, sel, (cid) => nav("concept", cid), true);
  const left = (
    <div>
      <Section title="포함 관계 있는 개념">
        {withChildren.length ? withChildren.map((cid) => (
          <div key={cid} style={{ marginBottom: 4 }}>
            <HoverRow active={sel === cid} onClick={() => nav("concept", cid)} style={{ padding: "3px 8px", borderRadius: 4 }}>
              <span style={{ ...mono, fontSize: 13.5, color: "var(--accent)" }}>{cid}</span></HoverRow>
            {children[cid].map((ch) => (
              <HoverRow key={ch} active={sel === ch} onClick={() => nav("concept", ch)}
                style={{ padding: "2px 8px 2px 22px", borderRadius: 4 }}>
                <span style={{ ...mono, fontSize: 12.5, color: "var(--sig)" }}>└ {ch}</span></HoverRow>))}
          </div>)) : <div style={{ color: "var(--dim)", fontSize: 13 }}>없음</div>}
      </Section>
      <Section title={`그 외 개념 ${flat.length}`}>
        {flat.map((cid) => (
          <HoverRow key={cid} active={sel === cid} onClick={() => nav("concept", cid)} style={{ padding: "3px 8px", borderRadius: 4 }}>
            <span style={{ ...mono, fontSize: 13, color: "var(--text)" }}>{cid}</span></HoverRow>))}
      </Section>
    </div>);

  const c = concepts[sel] || {};
  const kids = children[sel] || [];
  function colChip(id) {
    const g = G.golden.per_column[id] || {};
    return <Chip key={id} color={VERDICT_COLOR[g.verdict]} onClick={() => nav("render", id)} title={id}>
      {colName(id)} <span style={{ color: "var(--dim)" }}>{ROLE_LABEL[(L.wt(id, G)).role] || ""}</span></Chip>;
  }
  const right = (
    <div style={{ maxWidth: 820 }}>
      <div style={{ ...mono, fontSize: 19, color: "var(--accent)" }}>{sel}
        <Badge color={dc(conceptDomain(sel))}>{conceptDomain(sel)}</Badge></div>
      {c.surfaces && c.surfaces.length > 0 &&
        <div style={{ marginTop: 8 }}>{c.surfaces.map((s) => <Chip key={s}>{s}</Chip>)}</div>}

      {c.direct && c.direct.length > 0 &&
        <Section title="직접객체 (개념 자체를 담는 컬럼)">{c.direct.map(colChip)}</Section>}
      {kids.length > 0 &&
        <Section title="포함 하위 개념">
          {kids.map((ch) => (
            <div key={ch} style={{ marginBottom: 8 }}>
              <span style={{ ...mono, fontSize: 14, color: "var(--sig)", cursor: "pointer" }} onClick={() => nav("concept", ch)}>{ch}</span>
              <span style={{ marginLeft: 8 }}>{(concepts[ch].surfaces || []).map((s) => <Chip key={s}>{s}</Chip>)}</span>
            </div>))}
        </Section>}
      {c.subs && c.subs.length > 0 &&
        <Section title="하위 (이 개념에 포함되는 컬럼)">{c.subs.map(colChip)}</Section>}
      {c.absorbed && c.absorbed.length > 0 &&
        <Section title="흡수 속성 (별도 용어 아님, 객체로 매달림)">{c.absorbed.map(colChip)}</Section>}
      {(!c.direct || !c.direct.length) && !kids.length && (!c.subs || !c.subs.length) && (!c.absorbed || !c.absorbed.length) &&
        <Section title="구성"><div style={{ color: "var(--dim)" }}>이 개념에 연결된 컬럼 정보가 골든에 없습니다.</div></Section>}
    </div>);
  return <TwoPane left={left} right={right} />;
}

// ===================== 셸 =====================
const TABS = [["overview", "개요"], ["schema", "구조"], ["render", "Render"], ["psql", "P-SQL"],
              ["gating", "게이팅"], ["collision", "충돌"], ["concept", "개념"]];

function parseHash() {
  const m = (location.hash || "").match(/^#([a-z]+)(?:\/(.+))?$/);
  if (!m) return { v: "overview", sel: null };
  return { v: m[1], sel: m[2] ? decodeURIComponent(m[2]) : null };
}

function App({ G }) {
  const [route, setRoute] = useState(parseHash);
  function nav(v, sel, hl) {
    const r = { v, sel: sel || null, hl: hl || null };
    setRoute(r);
    try { history.replaceState(null, "", "#" + v + (sel ? "/" + encodeURIComponent(sel) : "")); } catch (e) {}
  }
  const tables = Object.keys(G.schema).length;
  const cols = Object.keys(G.golden.per_column).length;
  const props = { G, route, nav };
  return (
    <div>
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", padding: "10px 16px 0", borderBottom: "1px solid var(--border)" }}>
        <span style={{ ...mono, fontSize: 15, color: "var(--text)", marginRight: 14, paddingBottom: 8 }}>용어집 증강 mock</span>
        {TABS.map(([k, label]) => (
          <div key={k} onClick={() => nav(k, null)} style={{ ...mono, fontSize: 14.5, padding: "7px 14px", cursor: "pointer",
            color: route.v === k ? "var(--text)" : "var(--dim)",
            borderBottom: route.v === k ? "2px solid var(--accent)" : "2px solid transparent" }}>{label}</div>))}
        <div style={{ flex: 1 }} />
        <div style={{ paddingBottom: 6 }}><SearchBox G={G} nav={nav} /></div>
        <span style={{ ...mono, fontSize: 12, color: "var(--dim)", marginLeft: 12, paddingBottom: 9 }}>{tables}T · {cols}C</span>
      </div>
      {route.v === "overview" && <Overview {...props} />}
      {route.v === "schema" && <SchemaView {...props} />}
      {route.v === "render" && <RenderView {...props} />}
      {route.v === "psql" && <PsqlView {...props} />}
      {route.v === "gating" && <GatingView {...props} />}
      {route.v === "collision" && <CollisionView {...props} />}
      {route.v === "concept" && <ConceptView {...props} />}
    </div>);
}

// ===================== 부트스트랩 =====================
function Root() {
  const [G, setG] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    const files = ["schema", "render_output", "psql_output", "golden"];
    Promise.all(files.map((f) => fetch("data/" + f + ".json").then((r) => {
      if (!r.ok) throw new Error(f + ".json " + r.status); return r.json();
    }))).then(([schema, render, psql, golden]) => setG({ schema, render, psql, golden }))
      .catch((e) => setErr(String(e.message || e)));
  }, []);
  if (err) return <Center>로드 실패: {err}<br />(http 서버로 실행했는지 확인)</Center>;
  if (!G) return <Center>데이터 적재 중…</Center>;
  return <App G={G} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
