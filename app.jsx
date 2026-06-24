// ============================================================
// app.jsx — 은행 mock data 재료 뷰어.
//   보여주는 것은 재료(스키마·render 산출·SQL 로그 신호)와 그 신호에서
//   계산만으로 드러나는 관찰(표면형 겹침)뿐이다. 어떤 판정도 데이터에 없다.
// ============================================================
const { useState, useEffect, useRef, useMemo } = React;
const L = window.MViewer;
const mono = { fontFamily: "var(--mono)" };

const TYPE_LABEL = { entity: "entity", dimension_categorical: "categorical", dimension_time: "time", measure: "measure" };
const RISK_LABEL = { code_value_weak: "코드값 약함", format_trap: "형식 함정", near_confusion: "근접 혼동" };
const RISK_COLOR = { code_value_weak: "var(--low)", format_trap: "var(--med)", near_confusion: "var(--accent)" };

// ── 공통 ──────────────────────────────────────────────
function Center({ children }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", color: "var(--muted)", fontSize: 16 }}>{children}</div>;
}
function TwoPane({ left, right }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: "calc(100vh - 92px)" }}>
      <div style={{ borderRight: "1px solid var(--border)", padding: 14, overflowY: "auto", maxHeight: "calc(100vh - 92px)" }}>{left}</div>
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
function Badge({ color, children }) {
  return <span style={{ ...mono, fontSize: 11.5, color: color || "var(--dim)", border: `1px solid ${(color || "var(--dim)")}55`,
    borderRadius: 4, padding: "0px 6px", marginLeft: 5, whiteSpace: "nowrap", display: "inline-block", marginBottom: 2 }}>{children}</span>;
}
function HoverRow({ active, onClick, children, style }) {
  const [h, setH] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (active && ref.current && ref.current.scrollIntoView) ref.current.scrollIntoView({ block: "nearest" }); }, [active]);
  const bg = active ? "rgba(255,255,255,0.07)" : (h ? "rgba(255,255,255,0.035)" : "transparent");
  return <div ref={ref} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{ ...style, background: bg, transition: "background .12s", cursor: "pointer" }}>{children}</div>;
}
function Bar({ value, max, color, w }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return <div style={{ display: "inline-block", width: w || 120, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 3, verticalAlign: "middle" }}>
    <div style={{ width: pct + "%", height: "100%", background: color || "var(--sig)", borderRadius: 3 }} /></div>;
}
function Stat({ label, value, color }) {
  return <div style={{ border: "1px solid var(--border)", borderRadius: 7, padding: "12px 16px", minWidth: 96 }}>
    <div style={{ ...mono, fontSize: 24, color: color || "var(--text)" }}>{value}</div>
    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{label}</div></div>;
}
function GRow({ k, children, has }) {
  return <div style={{ display: "flex", gap: 8, marginBottom: 5 }}>
    <span style={{ color: "var(--muted)", width: 84, flexShrink: 0 }}>{k}</span>
    <span style={{ wordBreak: "break-word" }}>{has === false ? <span style={{ color: "var(--dim)" }}>없음</span> : children}</span></div>;
}
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
      let ni = i < 0 ? 0 : (e.key === "ArrowDown" ? Math.min(orderedIds.length - 1, i + 1) : Math.max(0, i - 1));
      if (orderedIds[ni] && orderedIds[ni] !== sel) onPick(orderedIds[ni]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, sel, active]);
}
const colName = L.colName, tableName = L.tableName;

// ── 검색 ──────────────────────────────────────────────
function SearchBox({ G, nav }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const results = q ? L.searchAll(G, q) : [];
  function go(r) { setOpen(false); setQ(""); nav("render", r.id); }
  return (
    <div style={{ position: "relative" }}>
      <input value={q} placeholder="컬럼·표면형·설명 검색" data-search="global" onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && results.length) go(results[0]); if (e.key === "Escape") setOpen(false); }}
        style={{ ...mono, fontSize: 14, width: 240, background: "rgba(0,0,0,0.3)", color: "var(--text)",
          border: "1px solid var(--border)", borderRadius: 4, padding: "5px 10px" }} />
      {open && results.length > 0 &&
        <div style={{ position: "absolute", top: "112%", right: 0, width: 400, zIndex: 50, background: "var(--panel)",
          border: "1px solid var(--border)", borderRadius: 6, maxHeight: 360, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {results.map((r, i) =>
            <div key={i} onClick={() => go(r)} style={{ display: "flex", gap: 9, padding: "7px 12px", cursor: "pointer", alignItems: "baseline", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ ...mono, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap" }}>{r.label}</span>
              <span style={{ fontSize: 13, color: "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</span>
            </div>)}
        </div>}
    </div>);
}

// ── 컬럼 리스트 (Render / SQL 공용) ───────────────────
function ColumnList({ G, sel, onPick }) {
  const [q, setQ] = useState("");
  let cols = L.allColumns(G);
  if (q) cols = cols.filter((id) => (id + (L.rend(id, G).description || "")).toLowerCase().includes(q.toLowerCase()));
  useListNav(cols, sel, onPick, true);
  const byTable = {};
  cols.forEach((id) => { const t = tableName(id); (byTable[t] = byTable[t] || []).push(id); });
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="컬럼 필터"
        style={{ ...mono, fontSize: 13, width: "100%", background: "rgba(0,0,0,0.3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 9px", marginBottom: 10 }} />
      {Object.entries(byTable).map(([t, ids]) => (
        <div key={t} style={{ marginBottom: 10 }}>
          <div style={{ ...mono, fontSize: 11.5, color: "var(--dim)", marginBottom: 3 }}>{G.schema[t] ? G.schema[t].label : t}</div>
          {ids.map((id) => (
            <HoverRow key={id} active={sel === id} onClick={() => onPick(id)} style={{ padding: "3px 8px", borderRadius: 4 }}>
              <span style={{ ...mono, fontSize: 13, color: "var(--text)" }}>{colName(id)}</span>
            </HoverRow>))}
        </div>))}
    </div>);
}

// ── ① 개요 ────────────────────────────────────────────
function Overview({ G, nav }) {
  const dc = L.domainColor(G);
  const cols = L.allColumns(G);
  const doms = L.domains(G);
  const overlap = L.surfaceOverlap(G);
  // capability 분포
  const cap = {};
  cols.forEach((id) => (L.rend(id, G).type_candidate || []).forEach((t) => cap[t] = (cap[t] || 0) + 1));
  // 빈도 분포 버킷
  const buckets = [["0", 0], ["1-50", 0], ["50-150", 0], ["150-400", 0], ["400+", 0]];
  cols.forEach((id) => { const f = L.freqOf(id, G);
    const i = f === 0 ? 0 : f < 50 ? 1 : f < 150 ? 2 : f < 400 ? 3 : 4; buckets[i][1]++; });
  const maxB = Math.max(...buckets.map((b) => b[1]));
  // risk_flags 분포
  const rf = {};
  cols.forEach((id) => (L.rend(id, G).risk_flags || []).forEach((f) => rf[f] = (rf[f] || 0) + 1));
  const agg = (G.psql.agg_patterns || []).length;

  return (
    <div style={{ padding: "22px 30px", maxWidth: 1040 }}>
      <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--sig)", borderRadius: 7, padding: "12px 18px", marginBottom: 18 }}>
        <div style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7 }}>
          실험의 재료가 되는 은행 mock data입니다. 스키마, render 산출(자연어 설명 + 구조화 출력), SQL 로그 신호만 담겨 있고
          어떤 판정(용어 여부·충돌·우선순위)도 데이터에 없습니다. 판정은 이 재료 위에서 파이프라인을 돌려 산출하고 분석할 몫입니다.
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Stat label="도메인" value={doms.length} />
        <Stat label="테이블" value={Object.keys(G.schema).length} />
        <Stat label="컬럼" value={cols.length} />
        <Stat label="집계 패턴" value={agg} color="var(--lin)" />
        <Stat label="겹치는 표면형" value={Object.keys(overlap).length} color="var(--accent)" />
      </div>

      <Section title="도메인">
        <div>{doms.map((d) => <Chip key={d} color={dc(d)} onClick={() => nav("schema")}>{d}</Chip>)}</div>
      </Section>

      <Section title="빈도 분포 (파레토성: 소수 고빈도, 다수 저빈도)">
        <table style={{ ...mono, fontSize: 13 }}><tbody>
          {buckets.map(([lab, n]) => (
            <tr key={lab}><td style={{ color: "var(--muted)", padding: "2px 12px 2px 0", width: 70 }}>{lab}</td>
              <td style={{ padding: "2px 10px 2px 0" }}><Bar value={n} max={maxB} w={180} /></td>
              <td style={{ color: "var(--text)" }}>{n}</td></tr>))}
        </tbody></table>
      </Section>

      <Section title="capability 후보 분포 (render type_candidate)">
        <div>{Object.entries(cap).sort((a, b) => b[1] - a[1]).map(([t, n]) =>
          <span key={t} style={{ marginRight: 16 }}><Chip color="var(--sig)">{TYPE_LABEL[t] || t}</Chip><span style={{ ...mono, fontSize: 13, color: "var(--muted)" }}>{n}</span></span>)}</div>
      </Section>

      <Section title="구조 오류위험 플래그 (render가 구조에서 파생, 소수)"
        note="코드값 결손·형식 함정·근접 혼동. 이건 render 산출이지 처리 판정이 아닙니다.">
        <div>{Object.keys(rf).length ? Object.entries(rf).map(([f, n]) =>
          <span key={f} style={{ marginRight: 16 }}><Chip color={RISK_COLOR[f]}>{RISK_LABEL[f] || f}</Chip><span style={{ ...mono, fontSize: 13, color: "var(--muted)" }}>{n}</span></span>)
          : <span style={{ color: "var(--dim)" }}>없음</span>}</div>
      </Section>
    </div>);
}

// ── ② 구조 ────────────────────────────────────────────
function SchemaView({ G, route, nav }) {
  const dc = L.domainColor(G);
  const tables = Object.keys(G.schema);
  const byDom = {};
  tables.forEach((tk) => { const d = G.schema[tk].schema; (byDom[d] = byDom[d] || []).push(tk); });
  const sel = route.sel && G.schema[route.sel] ? route.sel : tables[0];
  useListNav(Object.values(byDom).flat(), sel, (tk) => nav("schema", tk), true);

  const left = Object.entries(byDom).map(([d, tks]) => (
    <div key={d} style={{ marginBottom: 12 }}>
      <div style={{ ...mono, fontSize: 13, letterSpacing: "0.05em", color: dc(d), marginBottom: 5 }}>{d}</div>
      {tks.map((tk) => (
        <HoverRow key={tk} active={sel === tk} onClick={() => nav("schema", tk)} style={{ padding: "4px 8px", borderRadius: 4 }}>
          <span style={{ ...mono, fontSize: 13, color: "var(--text)" }}>{G.schema[tk].table}</span>
          <span style={{ fontSize: 11.5, color: "var(--dim)", marginLeft: 6 }}>{G.schema[tk].label}</span>
        </HoverRow>))}
    </div>));

  const t = G.schema[sel];
  const right = (
    <div style={{ maxWidth: 900 }}>
      <div style={{ ...mono, fontSize: 19, color: "var(--text)" }}>{t.table}</div>
      <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 3 }}>{t.label} · {t.schema}</div>
      <Section title={`컬럼 ${t.columns.length}`}>
        <table style={{ ...mono, fontSize: 13, width: "100%" }}>
          <thead><tr style={{ color: "var(--muted)", textAlign: "left" }}>
            {["컬럼", "타입", "키", "표면형"].map((h) => <th key={h} style={{ padding: "4px 12px 8px 0", borderBottom: "1px solid var(--border)", fontWeight: 400 }}>{h}</th>)}
          </tr></thead>
          <tbody>{t.columns.map((c) => { const id = sel + "." + c.name; const surf = L.surfaceForms(id, G);
            return (
              <tr key={c.name}>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--text)", cursor: "pointer" }} onClick={() => nav("render", id)}>{c.name}</td>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--dim)" }}>{c.dtype}</td>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--accent)" }}>{c.pk ? "PK" : c.fk ? "FK" : ""}</td>
                <td style={{ padding: "5px 12px 5px 0", color: "var(--lin)" }}>{surf.join(", ") || "-"}</td>
              </tr>);
          })}</tbody>
        </table>
      </Section>
    </div>);
  return <TwoPane left={left} right={right} />;
}

// ── ③ Render 산출 ─────────────────────────────────────
function RenderView({ G, route, nav }) {
  const dc = L.domainColor(G);
  const first = L.allColumns(G)[0];
  const sel = route.sel && G.render[route.sel] ? route.sel : first;
  const r = L.rend(sel, G);
  const right = (
    <div style={{ maxWidth: 760 }}>
      <div style={{ ...mono, fontSize: 18, color: "var(--text)" }}>{colName(sel)}<Badge color={dc(L.domainOf(sel))}>{L.domainOf(sel)}</Badge></div>
      <div style={{ ...mono, fontSize: 12.5, color: "var(--dim)", marginTop: 3, marginBottom: 16 }}>{sel}</div>
      <div style={{ ...mono, fontSize: 13, lineHeight: 1.4 }}>
        <GRow k="설명" has={!!r.description}><span style={{ fontFamily: "var(--sans)", color: "var(--text)", lineHeight: 1.6 }}>{r.description}</span></GRow>
        <GRow k="타입" has={(r.type_candidate || []).length > 0}>
          {(r.type_candidate || []).map((t) => <Chip key={t} color="var(--sig)">{TYPE_LABEL[t] || t}</Chip>)}
          {(r.type_candidate || []).length > 1 && <span style={{ fontSize: 12, color: "var(--med)" }}>다용도</span>}</GRow>
        <GRow k="위험" has={(r.risk_flags || []).length > 0}>{(r.risk_flags || []).map((f) => <Chip key={f} color={RISK_COLOR[f]}>{RISK_LABEL[f] || f}</Chip>)}</GRow>
        <GRow k="표면형" has={(r.surface_candidates || []).length > 0}>{(r.surface_candidates || []).map((s) => <Chip key={s}>{s}</Chip>)}</GRow>
        <GRow k="형식" has={!!r.format}><span style={{ color: "var(--lin)" }}>{r.format}</span></GRow>
        <GRow k="신뢰도" has={!!r.confidence}><span style={{ color: "var(--text)" }}>{r.confidence}</span></GRow>
        <GRow k="코드값" has={!!r.codedict}>{r.codedict && <span style={{ color: "var(--text)" }}>{Object.entries(r.codedict).map(([k, v]) => k + "=" + v).join(" · ")}</span>}</GRow>
      </div>
    </div>);
  return <TwoPane left={<ColumnList G={G} sel={sel} onPick={(id) => nav("render", id)} />} right={right} />;
}

// ── ④ SQL 로그 신호 ───────────────────────────────────
function PsqlView({ G, route, nav }) {
  const first = L.allColumns(G)[0];
  const sel = route.sel && L.psqlOf(route.sel, G) !== undefined ? route.sel : first;
  const p = L.psqlOf(sel, G);
  const roleMax = p ? Math.max(1, ...Object.values(p.usage_roles || {})) : 1;
  const joinPairs = (G.psql.join_pairs || []).filter((x) => x.a === sel || x.b === sel);
  const cooc = (G.psql.cooccur || []).filter((x) => x.a === sel || x.b === sel).sort((a, b) => b.cooccur_freq - a.cooccur_freq).slice(0, 8);
  const aggs = (G.psql.agg_patterns || []).filter((x) => x.measure === sel);
  const right = (
    <div style={{ maxWidth: 760 }}>
      <div style={{ ...mono, fontSize: 18, color: "var(--text)" }}>{colName(sel)}</div>
      <div style={{ ...mono, fontSize: 12.5, color: "var(--dim)", marginTop: 3, marginBottom: 14 }}>{sel}</div>
      {!p ? <div style={{ color: "var(--dim)" }}>신호 없음</div> : (
        <div style={{ ...mono, fontSize: 13, lineHeight: 1.4 }}>
          <GRow k="분석 빈도">{p.analytic_freq === 0 ? <span style={{ color: "var(--low)" }}>0 — 신호 없음</span> : <span style={{ fontSize: 16, color: "var(--text)" }}>{p.analytic_freq}</span>}</GRow>
          <GRow k="사용 역할">
            <table style={{ ...mono, fontSize: 12.5 }}><tbody>
              {Object.entries(p.usage_roles || {}).map(([k, v]) =>
                <tr key={k}><td style={{ color: "var(--muted)", padding: "1px 10px 1px 0", width: 56 }}>{k}</td>
                  <td style={{ padding: "1px 8px 1px 0" }}><Bar value={v} max={roleMax} w={80} /></td>
                  <td style={{ color: "var(--text)" }}>{v}</td></tr>)}
            </tbody></table></GRow>
          <GRow k="where 리터럴" has={(p.where_literals || []).length > 0}>{(p.where_literals || []).map((x) => <Chip key={x} color="var(--accent)">{x}</Chip>)}</GRow>
          <GRow k="별칭" has={(p.aliases || []).length > 0}>{(p.aliases || []).map((x) => <Chip key={x}>{x}</Chip>)}</GRow>
        </div>)}
      {joinPairs.length > 0 &&
        <Section title="조인 쌍 (선언된 FK 신호)">
          {joinPairs.map((x, i) => <div key={i} style={{ ...mono, fontSize: 12.5, color: "var(--muted)", marginBottom: 2 }}>
            {colName(x.a)} ↔ {x.b} <span style={{ color: "var(--dim)" }}>({x.join_freq})</span></div>)}
        </Section>}
      {cooc.length > 0 &&
        <Section title="공동참조 (함께 조회된 빈도)">
          {cooc.map((x, i) => { const o = x.a === sel ? x.b : x.a;
            return <div key={i} style={{ ...mono, fontSize: 12.5, color: "var(--muted)", marginBottom: 2 }}>{colName(o)} <span style={{ color: "var(--dim)" }}>({x.cooccur_freq})</span></div>; })}
        </Section>}
      {aggs.length > 0 &&
        <Section title="집계 패턴 (이 컬럼이 집계된 방식)">
          {aggs.map((x, i) => <div key={i} style={{ ...mono, fontSize: 12.5, color: "var(--muted)", marginBottom: 2 }}>
            {x.agg_func} <span style={{ color: "var(--dim)" }}>by</span> {x.group_by.map(colName).join(", ")} <span style={{ color: "var(--dim)" }}>({x.freq})</span></div>)}
        </Section>}
    </div>);
  return <TwoPane left={<ColumnList G={G} sel={sel} onPick={(id) => nav("psql", id)} />} right={right} />;
}

// ── ⑤ 표면형 겹침 관찰 ────────────────────────────────
function SurfaceView({ G, nav }) {
  const dc = L.domainColor(G);
  const overlap = L.surfaceOverlap(G);
  const aggs = G.psql.agg_patterns || [];
  return (
    <div style={{ padding: "18px 26px", maxWidth: 1020 }}>
      <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)", borderRadius: 7, padding: "12px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7 }}>
          render가 낸 표면형 후보가 여러 컬럼에 겹치는 지점을 계산만으로 모은 관찰입니다.
          이것은 충돌이라는 판정이 아닙니다. 무엇이 실제 충돌이고 어떻게 변별할지는 파이프라인을 돌려 정할 몫입니다.
          여기서는 단지 같은 이름이 어디에 흩어져 있는지를 보여줍니다.
        </div>
      </div>
      <Section title={`표면형 겹침 — ${Object.keys(overlap).length}개 (2개 이상 도메인)`}>
        {Object.entries(overlap).sort((a, b) => b[1].length - a[1].length).map(([sf, ids]) => {
          const doms = [...new Set(ids.map(L.domainOf))];
          return (
            <div key={sf} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "7px 12px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
              <span style={{ ...mono, fontSize: 14.5, color: "var(--accent)", width: 96, flexShrink: 0 }}>{sf}</span>
              <span style={{ ...mono, fontSize: 11.5, color: "var(--dim)", width: 60, flexShrink: 0 }}>{doms.length}도메인</span>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {ids.map((id) => <Chip key={id} color={dc(L.domainOf(id))} onClick={() => nav("render", id)} title={id}>{colName(id)} <span style={{ color: "var(--dim)" }}>·{L.domainOf(id)}</span></Chip>)}
              </div>
            </div>);
        })}
      </Section>
      <Section title={`집계 패턴 — ${aggs.length}개 (metric 후보 신호)`}
        note="수치 컬럼이 어떤 차원으로 집계됐는지의 로그 신호입니다. 무엇이 metric인지는 정하지 않습니다.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
          {aggs.sort((a, b) => b.freq - a.freq).slice(0, 24).map((x, i) => (
            <div key={i} style={{ ...mono, fontSize: 12.5, color: "var(--muted)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 5, padding: "6px 10px" }}>
              <span style={{ color: "var(--text)", cursor: "pointer" }} onClick={() => nav("psql", x.measure)}>{colName(x.measure)}</span>
              <span style={{ color: "var(--dim)" }}> · {x.agg_func} by {x.group_by.map(colName).join(", ")} ({x.freq})</span>
            </div>))}
        </div>
      </Section>
    </div>);
}

// ── 셸 ────────────────────────────────────────────────
const TABS = [["overview", "개요"], ["schema", "구조"], ["render", "Render"], ["psql", "SQL 신호"], ["surface", "표면형 관찰"]];
function parseHash() {
  const m = (location.hash || "").match(/^#([a-z]+)(?:\/(.+))?$/);
  if (!m) return { v: "overview", sel: null };
  const vmap = { gating: "render", concept: "surface", collision: "surface", column: "render" };
  return { v: vmap[m[1]] || m[1], sel: m[2] ? decodeURIComponent(m[2]) : null };
}
function App({ G }) {
  const [route, setRoute] = useState(parseHash);
  function nav(v, sel) { const r = { v, sel: sel || null }; setRoute(r);
    try { history.replaceState(null, "", "#" + v + (sel ? "/" + encodeURIComponent(sel) : "")); } catch (e) {} }
  const props = { G, route, nav };
  return (
    <div>
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", padding: "10px 16px 0", borderBottom: "1px solid var(--border)" }}>
        <span style={{ ...mono, fontSize: 15, color: "var(--text)", marginRight: 14, paddingBottom: 8 }}>은행 mock data</span>
        {TABS.map(([k, label]) => (
          <div key={k} onClick={() => nav(k, null)} style={{ ...mono, fontSize: 14.5, padding: "7px 14px", cursor: "pointer",
            color: route.v === k ? "var(--text)" : "var(--dim)", borderBottom: route.v === k ? "2px solid var(--accent)" : "2px solid transparent" }}>{label}</div>))}
        <div style={{ flex: 1 }} />
        <div style={{ paddingBottom: 6 }}><SearchBox G={G} nav={nav} /></div>
      </div>
      {route.v === "overview" && <Overview {...props} />}
      {route.v === "schema" && <SchemaView {...props} />}
      {route.v === "render" && <RenderView {...props} />}
      {route.v === "psql" && <PsqlView {...props} />}
      {route.v === "surface" && <SurfaceView {...props} />}
    </div>);
}
function Root() {
  const [G, setG] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => {
    Promise.all(["schema", "render_output", "psql_output"].map((f) => fetch("data/" + f + ".json").then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); })))
      .then(([schema, render, psql]) => setG({ schema, render, psql })).catch((e) => setErr(String(e.message || e)));
  }, []);
  if (err) return <Center>로드 실패: {err}<br />(http 서버로 실행했는지 확인)</Center>;
  if (!G) return <Center>데이터 적재 중…</Center>;
  return <App G={G} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
