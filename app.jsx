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
    <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", minHeight: "calc(100vh - 92px)" }}>
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
  function go(r) { setOpen(false); setQ(""); nav("table", tableName(r.id), r.id); }
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

// ── FK 이웃 그래프 ────────────────────────────────────
function FkGraph({ tk, G, nav }) {
  const inn = L.fkIn(tk, G), out = L.fkOut(tk, G);
  if (!inn.length && !out.length) return null;
  const rowH = 24, H = Math.max(inn.length, out.length, 1) * rowH + 40, W = 900, cy = H / 2;
  const short = (s) => { const n = L.colName(s) === s ? s : s.split(".")[1]; return n.length > 16 ? n.slice(0, 15) + "…" : n; };
  return (
    <Section title={`FK 이웃 — 들어오는 ${inn.length} · 나가는 ${out.length}`}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {inn.map((e, i) => { const y = 26 + i * rowH;
          return <g key={"i" + i}>
            <path d={`M 270 ${y} C 340 ${y}, 360 ${cy}, 410 ${cy}`} stroke="var(--border)" fill="none" />
            <text x={264} y={y + 4} textAnchor="end" onClick={() => nav("table", e.from)} style={{ fill: "var(--sig)", fontSize: 13, fontFamily: "var(--mono)", cursor: "pointer" }}>{G.schema[e.from] ? G.schema[e.from].table : e.from}</text>
            <text x={284} y={y - 5} style={{ fill: "var(--dim)", fontSize: 10.5, fontFamily: "var(--mono)" }}>{e.via}</text></g>; })}
        {out.map((e, i) => { const y = 26 + i * rowH;
          return <g key={"o" + i}>
            <path d={`M 500 ${cy} C 545 ${cy}, 565 ${y}, 635 ${y}`} stroke="var(--border)" fill="none" />
            <text x={640} y={y + 4} textAnchor="start" onClick={() => nav("table", e.to)} style={{ fill: "var(--accent)", fontSize: 13, fontFamily: "var(--mono)", cursor: "pointer" }}>{G.schema[e.to] ? G.schema[e.to].table : L.colName(e.to)}</text>
            <text x={568} y={y - 5} style={{ fill: "var(--dim)", fontSize: 10.5, fontFamily: "var(--mono)" }}>{e.via}</text></g>; })}
        <rect x={410} y={cy - 13} width={90} height={26} rx={5} fill="rgba(255,255,255,0.05)" stroke="var(--border)" />
        <text x={455} y={cy + 4} textAnchor="middle" style={{ fill: "var(--text)", fontSize: 11.5, fontFamily: "var(--mono)", fontWeight: 600 }}>{short(tk)}</text>
      </svg>
    </Section>);
}

// ── 컬럼 상세 펼침 (행 클릭 시) ───────────────────────
function ColExpand({ id, G }) {
  const r = L.rend(id, G), p = L.psqlOf(id, G);
  const roleMax = p ? Math.max(1, ...Object.values(p.usage_roles || {})) : 1;
  const joinPairs = (G.psql.join_pairs || []).filter((x) => x.a === id || x.b === id);
  const cooc = (G.psql.cooccur || []).filter((x) => x.a === id || x.b === id).sort((a, b) => b.cooccur_freq - a.cooccur_freq).slice(0, 6);
  const aggs = (G.psql.agg_patterns || []).filter((x) => x.measure === id);
  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)", borderRadius: 7, padding: "13px 17px", margin: "4px 0 12px" }}>
      <div style={{ ...mono, fontSize: 15, color: "var(--text)", marginBottom: 10 }}>{colName(id)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ ...mono, fontSize: 12.5, lineHeight: 1.4 }}>
          <div style={{ ...mono, fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>RENDER</div>
          <GRow k="설명" has={!!r.description}><span style={{ fontFamily: "var(--sans)", color: "var(--text)", lineHeight: 1.6 }}>{r.description}</span></GRow>
          <GRow k="타입" has={(r.type_candidate || []).length > 0}>{(r.type_candidate || []).map((t) => <Chip key={t} color="var(--sig)">{TYPE_LABEL[t] || t}</Chip>)}</GRow>
          <GRow k="위험" has={(r.risk_flags || []).length > 0}>{(r.risk_flags || []).map((f) => <Chip key={f} color={RISK_COLOR[f]}>{RISK_LABEL[f] || f}</Chip>)}</GRow>
          <GRow k="표면형" has={(r.surface_candidates || []).length > 0}>{(r.surface_candidates || []).map((s) => <Chip key={s}>{s}</Chip>)}</GRow>
          <GRow k="형식" has={!!r.format}><span style={{ color: "var(--lin)" }}>{r.format}</span></GRow>
          <GRow k="신뢰도" has={!!r.confidence}><span style={{ color: "var(--text)" }}>{r.confidence}</span></GRow>
          <GRow k="코드값" has={!!r.codedict}>{r.codedict && <span style={{ color: "var(--text)" }}>{Object.entries(r.codedict).map(([k, v]) => k + "=" + v).join(" · ")}</span>}</GRow>
        </div>
        <div style={{ ...mono, fontSize: 12.5, lineHeight: 1.4 }}>
          <div style={{ ...mono, fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>SQL 신호</div>
          <GRow k="빈도">{!p || p.analytic_freq === 0 ? <span style={{ color: "var(--low)" }}>0 — 신호 없음</span> : <span style={{ fontSize: 15, color: "var(--text)" }}>{p.analytic_freq}</span>}</GRow>
          {p && <GRow k="역할">
            <table style={{ ...mono, fontSize: 12 }}><tbody>
              {Object.entries(p.usage_roles || {}).map(([k, v]) => <tr key={k}><td style={{ color: "var(--muted)", padding: "1px 8px 1px 0", width: 62, whiteSpace: "nowrap" }}>{k}</td><td style={{ padding: "1px 6px 1px 0" }}><Bar value={v} max={roleMax} w={64} /></td><td style={{ color: "var(--text)" }}>{v}</td></tr>)}
            </tbody></table></GRow>}
          {p && <GRow k="리터럴" has={(p.where_literals || []).length > 0}>{(p.where_literals || []).map((x) => <Chip key={x} color="var(--accent)">{x}</Chip>)}</GRow>}
          {p && <GRow k="별칭" has={(p.aliases || []).length > 0}>{(p.aliases || []).map((x) => <Chip key={x}>{x}</Chip>)}</GRow>}
          {joinPairs.length > 0 && <GRow k="조인">{joinPairs.map((x, i) => <div key={i} style={{ color: "var(--muted)" }}>{colName(x.a)} ↔ {colName(x.b)} ({x.join_freq})</div>)}</GRow>}
          {cooc.length > 0 && <GRow k="공동참조">{cooc.map((x, i) => { const o = x.a === id ? x.b : x.a; return <span key={i} style={{ color: "var(--muted)", marginRight: 8 }}>{colName(o)}({x.cooccur_freq})</span>; })}</GRow>}
          {aggs.length > 0 && <GRow k="집계">{aggs.map((x, i) => <div key={i} style={{ color: "var(--muted)" }}>{x.agg_func} by {x.group_by.map(colName).join(", ")} ({x.freq})</div>)}</GRow>}
        </div>
      </div>
    </div>);
}

// ── ① 개요 ────────────────────────────────────────────
function Overview({ G, nav }) {
  const dc = L.domainColor(G);
  const cols = L.allColumns(G);
  const doms = L.domains(G);
  const overlap = L.surfaceOverlap(G);
  const cap = {};
  cols.forEach((id) => (L.rend(id, G).type_candidate || []).forEach((t) => cap[t] = (cap[t] || 0) + 1));
  const buckets = [["0", 0], ["1-50", 0], ["50-150", 0], ["150-400", 0], ["400+", 0]];
  cols.forEach((id) => { const f = L.freqOf(id, G);
    const i = f === 0 ? 0 : f < 50 ? 1 : f < 150 ? 2 : f < 400 ? 3 : 4; buckets[i][1]++; });
  const maxB = Math.max(...buckets.map((b) => b[1]));
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
        <div>{doms.map((d) => <Chip key={d} color={dc(d)} onClick={() => nav("table")}>{d}</Chip>)}</div>
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

// ── 테이블 화면 (구조 + render + SQL 신호 통합) ───────
function TableView({ G, route, nav }) {
  const dc = L.domainColor(G);
  const byDom = L.tablesByDomain(G);
  const tables = Object.values(byDom).flat();
  const sel = route.sel && G.schema[route.sel] ? route.sel : tables[0];
  useListNav(tables, sel, (tk) => nav("table", tk), true);
  const firstId = () => sel + "." + G.schema[sel].columns[0].name;
  const [openCol, setOpenCol] = useState(route.hl || firstId());
  useEffect(() => { setOpenCol(route.hl || firstId()); }, [sel, route.hl]);
  const [wide, setWide] = useState(typeof window !== "undefined" ? window.innerWidth >= 1180 : true);
  useEffect(() => { const h = () => setWide(window.innerWidth >= 1180); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const left = Object.entries(byDom).map(([d, tks]) => (
    <div key={d} style={{ marginBottom: 12 }}>
      <div style={{ ...mono, fontSize: 13, letterSpacing: "0.05em", color: dc(d), marginBottom: 5 }}>{d}</div>
      {tks.map((tk) => (
        <HoverRow key={tk} active={sel === tk} onClick={() => nav("table", tk)} style={{ padding: "4px 8px", borderRadius: 4 }}>
          <span style={{ ...mono, fontSize: 13, color: "var(--text)" }}>{G.schema[tk].table}</span>
          <span style={{ fontSize: 11, color: "var(--dim)", marginLeft: 6 }}>{G.schema[tk].label}</span>
        </HoverRow>))}
    </div>));

  const t = G.schema[sel];
  const cols = t.columns;
  // SQL 신호: 빈도 정렬
  const freqRows = cols.map((c) => ({ id: sel + "." + c.name, name: c.name, f: L.freqOf(sel + "." + c.name, G) })).sort((a, b) => b.f - a.f);
  const fmax = Math.max(1, ...freqRows.map((x) => x.f));
  const tableAggs = (G.psql.agg_patterns || []).filter((x) => L.tableName(x.measure) === sel);

  const right = (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <span style={{ ...mono, fontSize: 20, color: "var(--text)" }}>{t.table}</span>
        <span style={{ ...mono, fontSize: 13, color: dc(t.schema) }}>{t.schema}</span>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>{t.label}</span>
        <span style={{ ...mono, fontSize: 13, color: "var(--dim)" }}>{cols.length}컬럼</span>
      </div>
      <FkGraph tk={sel} G={G} nav={nav} />

      <Section title="컬럼 (행 클릭 → 상세 펼침)">
        <table style={{ ...mono, fontSize: 13.5, width: "100%" }}>
          <thead><tr style={{ color: "var(--muted)", textAlign: "left" }}>
            {["컬럼", "타입", "키", "표면형", "설명"].map((h) => <th key={h} style={{ padding: "4px 10px 8px 0", borderBottom: "1px solid var(--border)", fontWeight: 400 }}>{h}</th>)}
          </tr></thead>
          <tbody>{cols.map((c) => {
            const id = sel + "." + c.name;
            const r = L.rend(id, G);
            const surf = L.surfaceForms(id, G);
            const open = openCol === id;
            return (
              <React.Fragment key={c.name}>
                <tr onClick={() => setOpenCol(id)} style={{ cursor: "pointer", background: open ? "rgba(232,179,65,0.08)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "5px 10px 5px 0", color: "var(--text)", whiteSpace: "nowrap" }}>
                    {c.name}
                    {(r.risk_flags || []).map((f) => <Badge key={f} color={RISK_COLOR[f]}>{RISK_LABEL[f] || f}</Badge>)}
                    {r.codedict && <Badge color="var(--high)">코드</Badge>}
                  </td>
                  <td style={{ padding: "5px 10px 5px 0", color: "var(--dim)", whiteSpace: "nowrap" }}>{c.dtype}</td>
                  <td style={{ padding: "5px 10px 5px 0", color: "var(--sig)", whiteSpace: "nowrap", cursor: c.fk ? "pointer" : "default" }}
                    onClick={c.fk ? (e) => { e.stopPropagation(); nav("table", c.fk.split(".").slice(0, 2).join(".")); } : undefined}>
                    {c.pk ? "PK" : c.fk ? "FK→" + L.tableName(c.fk).split(".")[1] : ""}</td>
                  <td style={{ padding: "5px 10px 5px 0", color: "var(--lin)", whiteSpace: "nowrap" }}>{surf.join(", ") || "-"}</td>
                  <td style={{ padding: "5px 10px 5px 0", color: "var(--muted)", fontFamily: "var(--sans)", fontSize: 14 }}>{r.description || "-"}</td>
                </tr>
              </React.Fragment>);
          })}</tbody>
        </table>
      </Section>

      <Section title="SQL 신호 — 컬럼별 분석 빈도">
        <table style={{ ...mono, fontSize: 13 }}><tbody>
          {freqRows.map((x) => (
            <tr key={x.id}>
              <td style={{ color: "var(--text)", padding: "2px 12px 2px 0", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => setOpenCol(x.id)}>{x.name}</td>
              <td style={{ padding: "2px 10px 2px 0" }}><Bar value={x.f} max={fmax} w={180} color={x.f === 0 ? "var(--dim)" : "var(--sig)"} /></td>
              <td style={{ color: x.f === 0 ? "var(--dim)" : "var(--text)" }}>{x.f}</td>
            </tr>))}
        </tbody></table>
      </Section>

      {tableAggs.length > 0 &&
        <Section title="SQL 신호 — 집계 패턴 (이 테이블의 수치 컬럼)">
          {tableAggs.sort((a, b) => b.freq - a.freq).map((x, i) => (
            <div key={i} style={{ ...mono, fontSize: 12.5, color: "var(--muted)", marginBottom: 3 }}>
              <span style={{ color: "var(--text)", cursor: "pointer" }} onClick={() => setOpenCol(x.measure)}>{colName(x.measure)}</span>
              <span style={{ color: "var(--dim)" }}> · {x.agg_func} by {x.group_by.map(colName).join(", ")} ({x.freq})</span>
            </div>))}
        </Section>}
    </div>);
  return (
    <div style={{ display: "grid", gridTemplateColumns: wide ? "260px minmax(0,1fr) 440px" : "260px minmax(0,1fr)", minHeight: "calc(100vh - 92px)" }}>
      <div style={{ borderRight: "1px solid var(--border)", padding: 14, overflowY: "auto", maxHeight: "calc(100vh - 92px)" }}>{left}</div>
      <div style={{ padding: "18px 22px", overflowY: "auto", maxHeight: "calc(100vh - 92px)" }}>
        {right}
        {!wide && openCol && <div style={{ marginTop: 16 }}><ColExpand id={openCol} G={G} /></div>}
      </div>
      {wide && <div style={{ borderLeft: "1px solid var(--border)", padding: "18px", overflowY: "auto", maxHeight: "calc(100vh - 92px)" }}>
        {openCol ? <ColExpand id={openCol} G={G} /> : <div style={{ color: "var(--dim)" }}>컬럼을 선택하세요</div>}
      </div>}
    </div>);
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
                {ids.map((id) => <Chip key={id} color={dc(L.domainOf(id))} onClick={() => nav("table", tableName(id), id)} title={id}>{colName(id)} <span style={{ color: "var(--dim)" }}>·{L.domainOf(id)}</span></Chip>)}
              </div>
            </div>);
        })}
      </Section>
      <Section title={`집계 패턴 — ${aggs.length}개 (metric 후보 신호)`}
        note="수치 컬럼이 어떤 차원으로 집계됐는지의 로그 신호입니다. 무엇이 metric인지는 정하지 않습니다.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
          {aggs.sort((a, b) => b.freq - a.freq).slice(0, 24).map((x, i) => (
            <div key={i} style={{ ...mono, fontSize: 12.5, color: "var(--muted)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 5, padding: "6px 10px" }}>
              <span style={{ color: "var(--text)", cursor: "pointer" }} onClick={() => nav("table", tableName(x.measure), x.measure)}>{colName(x.measure)}</span>
              <span style={{ color: "var(--dim)" }}> · {x.agg_func} by {x.group_by.map(colName).join(", ")} ({x.freq})</span>
            </div>))}
        </div>
      </Section>
    </div>);
}

// ── 게이트 결과 화면 ──────────────────────────────────
const TAG_COLOR = { "빈도": "var(--sig)", "이명": "var(--lin)", "충돌": "var(--accent)", "metric": "var(--high)" };
function GateView({ G, nav }) {
  const gd = G.gate;
  const dc = L.domainColor(G);
  const allcols = L.allColumns(G);
  const passedIds = allcols.filter((c) => L.gateTags(c, G));
  const notPassed = allcols.filter((c) => !L.gateTags(c, G));
  const [filter, setFilter] = useState("all");
  const list = filter === "all" ? passedIds : filter === "notpass" ? notPassed
    : passedIds.filter((c) => (L.gateTags(c, G) || []).includes(filter));
  const [sel, setSel] = useState(passedIds[0] || null);
  useEffect(() => { if (!list.includes(sel)) setSel(list[0] || null); }, [filter]);

  const filters = [["all", `통과 ${passedIds.length}`], ["빈도", `빈도 ${gd.stats.by_tag["빈도"]}`],
    ["이명", `이명 ${gd.stats.by_tag["이명"]}`], ["충돌", `충돌 ${gd.stats.by_tag["충돌"]}`],
    ["metric", `metric ${gd.stats.by_tag["metric"]}`], ["notpass", `미통과 ${notPassed.length}`]];

  const left = (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
        {filters.map(([k, lab]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ ...mono, fontSize: 12.5, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
            background: filter === k ? "rgba(255,255,255,0.1)" : "transparent", color: filter === k ? "var(--text)" : "var(--muted)",
            border: `1px solid ${filter === k ? (TAG_COLOR[k] || "var(--border)") : "var(--border)"}` }}>{lab}</button>))}
      </div>
      {Object.entries((() => { const by = {}; list.forEach((id) => { const t = tableName(id); (by[t] = by[t] || []).push(id); }); return by; })()).map(([t, ids]) => (
        <div key={t} style={{ marginBottom: 9 }}>
          <div style={{ ...mono, fontSize: 11, color: "var(--dim)", marginBottom: 2 }}>{G.schema[t] ? G.schema[t].label : t}</div>
          {ids.map((id) => (
            <HoverRow key={id} active={sel === id} onClick={() => setSel(id)} style={{ padding: "3px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...mono, fontSize: 13, color: "var(--text)" }}>{colName(id)}</span>
              {(L.gateTags(id, G) || []).map((tg) => <span key={tg} style={{ width: 7, height: 7, borderRadius: 2, background: TAG_COLOR[tg], display: "inline-block" }} title={tg} />)}
            </HoverRow>))}
        </div>))}
    </div>);

  const right = sel ? (() => {
    const tags = L.gateTags(sel, G);
    const reasons = tags ? L.gateReason(sel, G) : [];
    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ ...mono, fontSize: 18, color: "var(--text)" }}>{colName(sel)}<Badge color={dc(L.domainOf(sel))}>{L.domainOf(sel)}</Badge></div>
        <div style={{ ...mono, fontSize: 12, color: "var(--dim)", marginTop: 3, marginBottom: 14 }}>{sel}</div>
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>{L.rend(sel, G).description}</div>
        {tags ? (
          <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--high)", borderRadius: 7, padding: "12px 16px" }}>
            <div style={{ ...mono, fontSize: 12, color: "var(--high)", marginBottom: 8 }}>통과 — 근거</div>
            {reasons.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 9, marginBottom: 6, alignItems: "baseline" }}>
                <span style={{ ...mono, fontSize: 11.5, color: TAG_COLOR[r.tag], border: `1px solid ${TAG_COLOR[r.tag]}66`, borderRadius: 4, padding: "1px 7px", flexShrink: 0 }}>{r.tag}</span>
                <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{r.text}</span>
              </div>))}
          </div>
        ) : (
          <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--dim)", borderRadius: 7, padding: "12px 16px" }}>
            <div style={{ ...mono, fontSize: 12, color: "var(--dim)", marginBottom: 6 }}>미통과 — 어느 조건에도 안 걸림</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>분석 빈도 {L.freqOf(sel, G)} · 표면형 {L.surfaceForms(sel, G).length}개</div>
          </div>)}
        <div style={{ marginTop: 14 }}>
          <span onClick={() => nav("table", tableName(sel), sel)} style={{ ...mono, fontSize: 12.5, color: "var(--sig)", cursor: "pointer" }}>→ 재료에서 이 컬럼 보기</span>
        </div>
      </div>);
  })() : <div style={{ color: "var(--dim)" }}>컬럼을 선택하세요</div>;

  return (
    <div>
      <div style={{ padding: "16px 26px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--high)", borderRadius: 7, padding: "12px 18px", maxWidth: 1040 }}>
          <div style={{ fontSize: 14.5, color: "var(--text)", marginBottom: 8 }}>
            Term을 만들 컬럼을 고르는 1차 게이트 결과입니다. 재료에 로직을 돌린 산출이지 재료가 아닙니다.
            전체 {gd.stats.total}개 중 <span style={{ color: "var(--high)" }}>{gd.stats.passed}개 통과</span>. 네 조건의 OR이고, 통과마다 어느 조건으로 걸렸는지 꼬리표를 답니다.
          </div>
          <div style={{ ...mono, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>
            빈도 임계 {gd.threshold} · {gd.threshold_basis}<br />
            {Object.entries(gd.conditions).map(([k, v]) => (
              <span key={k} style={{ display: "block" }}><span style={{ color: TAG_COLOR[k] }}>{k}</span> — {v}</span>))}
          </div>
        </div>
      </div>
      <TwoPane left={left} right={right} />
    </div>);
}

// ── 셸 ────────────────────────────────────────────────
const TABS = [["overview", "개요"], ["table", "테이블"], ["surface", "표면형 관찰"]];
function parseHash() {
  const m = (location.hash || "").match(/^#([a-z]+)(?:\/(.+))?$/);
  if (!m) return { v: "overview", sel: null };
  const vmap = { schema: "table", render: "table", psql: "table", gating: "table", concept: "surface", collision: "surface", column: "table" };
  return { v: vmap[m[1]] || m[1], sel: m[2] ? decodeURIComponent(m[2]) : null };
}
function App({ G }) {
  const [route, setRoute] = useState(parseHash);
  function nav(v, sel, hl) { const r = { v, sel: sel || null, hl: hl || null }; setRoute(r);
    try { history.replaceState(null, "", "#" + v + (sel ? "/" + encodeURIComponent(sel) : "")); } catch (e) {} }
  const props = { G, route, nav };
  const isGate = route.v === "gate";
  return (
    <div>
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 16px" }}>
          <span style={{ ...mono, fontSize: 15, color: "var(--text)", marginRight: 6 }}>은행 mock data</span>
          {[["재료", false, "overview"], ["게이트", true, "gate"]].map(([lab, g, dest]) => (
            <div key={lab} onClick={() => nav(dest, null)} style={{ ...mono, fontSize: 13.5, padding: "5px 16px", cursor: "pointer", borderRadius: 6,
              background: isGate === g ? "rgba(255,255,255,0.1)" : "transparent",
              color: isGate === g ? "var(--text)" : "var(--dim)", border: `1px solid ${isGate === g ? "var(--border)" : "transparent"}` }}>{lab}</div>))}
        </div>
        {!isGate &&
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", padding: "0 24px", background: "rgba(255,255,255,0.02)" }}>
            {TABS.map(([k, label]) => (
              <div key={k} onClick={() => nav(k, null)} style={{ ...mono, fontSize: 14, padding: "7px 14px", cursor: "pointer",
                color: route.v === k ? "var(--text)" : "var(--dim)", borderBottom: route.v === k ? "2px solid var(--accent)" : "2px solid transparent" }}>{label}</div>))}
            <div style={{ flex: 1 }} />
            <div style={{ paddingBottom: 5 }}><SearchBox G={G} nav={nav} /></div>
          </div>}
      </div>
      {route.v === "overview" && <Overview {...props} />}
      {route.v === "table" && <TableView {...props} />}
      {route.v === "surface" && <SurfaceView {...props} />}
      {route.v === "gate" && <GateView {...props} />}
    </div>);
}
function Root() {
  const [G, setG] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => {
    Promise.all(["schema", "render_output", "psql_output", "gate_output"].map((f) => fetch("data/" + f + ".json").then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); })))
      .then(([schema, render, psql, gate]) => setG({ schema, render, psql, gate })).catch((e) => setErr(String(e.message || e)));
  }, []);
  if (err) return <Center>로드 실패: {err}<br />(http 서버로 실행했는지 확인)</Center>;
  if (!G) return <Center>데이터 적재 중…</Center>;
  return <App G={G} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
