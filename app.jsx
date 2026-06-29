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

// ── 처리 단계 (1단계 / 1.5단계 / 2단계) ──────────────────────────────
const LINK_COLOR = { value_of: "var(--sig)", code_value_of: "var(--accent)", identified_by: "var(--high)", dated_by: "var(--lin)" };

// 키 상태 + 모델 셀렉터
function KeyAndModel() {
  const [_, rerender] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const has = window.LinkAPI.hasKey();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {!showKey && (
        <div onClick={() => setShowKey(true)} title={has ? "API 키 설정됨" : "API 키 없음"}
          style={{ ...mono, fontSize: 12, padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
            color: has ? "var(--high)" : "var(--low)" }}>
          {has ? "키 ✓" : "키 입력"}
        </div>
      )}
      {showKey && (
        <div style={{ display: "flex", gap: 4 }}>
          <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="sk-ant-..."
            style={{ ...mono, fontSize: 12, padding: "4px 8px", background: "var(--panel2)", border: "1px solid var(--border)",
              color: "var(--text)", borderRadius: 4, width: 200 }} />
          <button onClick={() => { window.LinkAPI.setKey(keyInput); setKeyInput(""); setShowKey(false); rerender(x=>x+1); }}
            style={{ ...mono, fontSize: 12, padding: "4px 10px", background: "var(--accent)", color: "#0c0e11",
              border: "none", borderRadius: 4, cursor: "pointer" }}>저장</button>
          <button onClick={() => { setShowKey(false); setKeyInput(""); }}
            style={{ ...mono, fontSize: 12, padding: "4px 8px", background: "transparent", color: "var(--dim)",
              border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }}>×</button>
          {has && <button onClick={() => { window.LinkAPI.clearKey(); rerender(x=>x+1); }}
            style={{ ...mono, fontSize: 12, padding: "4px 8px", background: "transparent", color: "var(--low)",
              border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }}>삭제</button>}
        </div>
      )}
      <select value={window.LinkAPI.getModel()} onChange={e => { window.LinkAPI.setModel(e.target.value); rerender(x=>x+1); }}
        style={{ ...mono, fontSize: 12.5, padding: "4px 8px", background: "var(--panel2)", color: "var(--text)",
          border: "1px solid var(--border)", borderRadius: 4 }}>
        {window.LinkAPI.MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    </div>
  );
}

// 스냅샷·즉석 배지
function ResultBadge({ source }) {
  const isLive = source && source.startsWith("live");
  return (
    <span style={{ ...mono, fontSize: 11, padding: "1px 7px", borderRadius: 3, marginLeft: 8,
      background: isLive ? "rgba(74,201,138,0.15)" : "rgba(107,169,224,0.12)",
      color: isLive ? "var(--high)" : "var(--sig)",
      border: `1px solid ${isLive ? "var(--high)" : "var(--sig)"}33` }}>
      {isLive ? "방금 실행" : "스냅샷"}
    </span>
  );
}

// 한 term의 작은 카드 (1단계에서 쓰임)
function TermMini({ term }) {
  const l = term.links[0];
  const linkLabel = l.type + (l.value ? `='${l.value}'` : "");
  const linkColor = LINK_COLOR[l.type] || "var(--text)";
  const syns = (term.synonyms || []).filter(s => s !== term.name);
  return (
    <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 5, marginBottom: 6, background: "rgba(0,0,0,0.15)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ ...mono, fontSize: 13.5, color: "var(--text)" }}>{term.name}</span>
        <Badge color={linkColor}>{linkLabel}</Badge>
      </div>
      {syns.length > 0 && (
        <div style={{ ...mono, fontSize: 12, color: "var(--lin)", marginTop: 3 }}>
          {syns.join(" · ")}
        </div>
      )}
    </div>
  );
}

// ─── 1단계 — 컬럼 컨텍스트 ↔ term의 시각적 연결 ───
function Stage1View({ G, route, nav }) {
  const passed = new Set(Object.keys(G.gate.gate || {}));
  const snapTerms = (G.snapshot && G.snapshot.stage1_terms) || {};
  
  // 게이트 통과 + term 있는 컬럼
  const allCids = Object.keys(snapTerms).filter(cid => passed.has(cid)).sort();
  const tables = useMemo(() => {
    const tk = new Set(); for (const cid of allCids) tk.add(tableName(cid));
    return [...tk].sort();
  }, [G]);
  
  const [selTable, setSelTable] = useState(tables[0]);
  const [selCol, setSelCol] = useState(null);
  const [liveResult, setLiveResult] = useState(null); // 즉석 결과
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const dc = L.domainColor(G);
  
  const cidsInTable = allCids.filter(cid => tableName(cid) === selTable);
  
  async function runOne(cid) {
    setRunning(true); setError(null); setSelCol(cid);
    try {
      const parts = cid.split("."), tk = parts.slice(0,2).join("."), cn = parts.slice(2).join(".");
      const sc = G.schema[tk].columns.find(c => c.name === cn);
      const r = G.render[cid] || {};
      const ctx = {
        column_id: cid, name: sc.name, dtype: sc.dtype, pk: sc.pk, fk: sc.fk,
        capability: (r.type_candidate || [null])[0],
        codedict: r.codedict, format: r.format,
        description: r.description || "", gate_tags: G.gate.gate[cid] || [],
      };
      const userMsg = "다음 컬럼에 대해 term을 생성하라. JSON 배열만 출력.\n\n" + JSON.stringify(ctx, null, 2);
      const text = await window.LinkAPI.callModel({ system: window.LinkPrompts.STAGE1, user: userMsg, maxTokens: 1500 });
      const result = window.LinkAPI.parseJSON(text);
      setLiveResult({ cid, terms: result });
    } catch (e) {
      setError(String(e.message || e));
    }
    setRunning(false);
  }
  
  // 좌측: 테이블 리스트. 우측: 컬럼 카드들 — 각 카드 안에 컨텍스트와 term이 좌우로 연결
  return (
    <TwoPane
      left={
        <div>
          <div style={{ ...mono, fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            게이트 통과 테이블 ({tables.length}개)
          </div>
          {tables.map(tk => (
            <HoverRow key={tk} active={selTable === tk} onClick={() => { setSelTable(tk); setSelCol(null); setLiveResult(null); }}
              style={{ padding: "4px 8px", borderRadius: 4 }}>
              <div style={{ ...mono, fontSize: 13, color: dc(L.domainOf(tk)) }}>{tk.split(".")[1]}</div>
              <div style={{ ...mono, fontSize: 11, color: "var(--dim)" }}>{tk.split(".")[0]}</div>
            </HoverRow>
          ))}
        </div>
      }
      right={
        <div>
          <div style={{ ...mono, fontSize: 15, color: "var(--text)", marginBottom: 4 }}>{selTable}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
            컬럼 컨텍스트(왼쪽)가 term(오른쪽)을 만듭니다. codedict 항목과 code_value_of term이 1:1 매칭됩니다.
          </div>
          {error && <div style={{ color: "var(--low)", ...mono, fontSize: 12.5, padding: 10, background: "rgba(224,107,94,0.08)", borderRadius: 4, marginBottom: 12 }}>{error}</div>}
          {cidsInTable.map(cid => {
            const cn = colName(cid);
            const r = G.render[cid] || {};
            const sc = (G.schema[tableName(cid)].columns || []).find(c => c.name === cn);
            const showLive = liveResult && liveResult.cid === cid;
            const terms = showLive ? liveResult.terms : snapTerms[cid];
            const codedict = r.codedict || {};
            const codedictKeys = Object.keys(codedict);
            
            return (
              <div key={cid} style={{ marginBottom: 22, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 6, background: "rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ ...mono, fontSize: 14, color: "var(--accent)", fontWeight: 500 }}>{cn}</span>
                  <span style={{ ...mono, fontSize: 11, color: "var(--dim)" }}>{sc && sc.dtype}{sc && sc.pk && " · PK"}{sc && sc.fk && " · FK→"+sc.fk.split(".").pop()}</span>
                  <ResultBadge source={showLive ? "live" : "snapshot"} />
                  <div style={{ flex: 1 }} />
                  <button onClick={() => runOne(cid)} disabled={running}
                    style={{ ...mono, fontSize: 11.5, padding: "3px 9px", background: "transparent", color: "var(--sig)",
                      border: "1px solid var(--border)", borderRadius: 4, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.4 : 1 }}>
                    {running && selCol === cid ? "실행 중…" : "▶ 즉석 실행"}
                  </button>
                  {showLive && <button onClick={() => { setLiveResult(null); setSelCol(null); }}
                    style={{ ...mono, fontSize: 11, padding: "3px 7px", background: "transparent", color: "var(--dim)",
                      border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }}>스냅샷으로</button>}
                </div>
                
                {/* 좌(컨텍스트) / 우(term) 매핑 — 핵심 시각 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {/* 좌측: 컨텍스트 */}
                  <div style={{ borderRight: "1px dashed var(--border)", paddingRight: 14 }}>
                    <div style={{ ...mono, fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>컨텍스트 (입력)</div>
                    <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 8, lineHeight: 1.55 }}>
                      {r.description}
                    </div>
                    {codedictKeys.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ ...mono, fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>codedict</div>
                        {codedictKeys.map(k => (
                          <div key={k} style={{ ...mono, fontSize: 12, color: "var(--text)", padding: "2px 0" }}>
                            <span style={{ color: "var(--accent)" }}>{k}</span> · {codedict[k]}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 우측: term */}
                  <div>
                    <div style={{ ...mono, fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>term {terms ? terms.length : 0}개 (출력)</div>
                    {(terms || []).map((t, i) => <TermMini key={i} term={t} />)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }
    />
  );
}

// ─── 1.5단계 — 클러스터링 ───
function Stage15View({ G, route, nav }) {
  const C = (G.snapshot && G.snapshot.clusters) || { clusters: [] };
  const [sel, setSel] = useState((C.clusters[0] || {}).key);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => 
    C.clusters.filter(c => !filter || c.key.includes(filter)), 
    [filter, C]);
  const selected = C.clusters.find(c => c.key === sel) || C.clusters[0];
  return (
    <TwoPane
      left={
        <div>
          <div style={{ ...mono, fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
            B-token 군집 · {C.clusters.length}개
          </div>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="호명 키 검색"
            style={{ width: "100%", ...mono, fontSize: 12.5, padding: "5px 8px", marginBottom: 8,
              background: "var(--panel2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 4 }} />
          {filtered.map(c => (
            <HoverRow key={c.key} active={(selected && selected.key === c.key)} onClick={() => setSel(c.key)} style={{ padding: "4px 8px", borderRadius: 4 }}>
              <div style={{ ...mono, fontSize: 12.5, color: "var(--text)" }}>{c.key} <span style={{ color: "var(--dim)" }}>· {c.size}</span></div>
            </HoverRow>
          ))}
        </div>
      }
      right={
        selected ? (
          <div>
            <div style={{ ...mono, fontSize: 18, color: "var(--text)" }}>"{selected.key}"</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>{selected.size}개 term이 이 호명을 공유합니다.</div>
            <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 14, lineHeight: 1.6 }}>
              1.5단계 클러스터링은 토큰 단위 매칭이라 글자만 겹치는 우연 매칭도 들어옵니다. 이 중 진짜 의미 충돌인지는 2단계 LLM이 가립니다.
            </div>
            <div>
              {selected.members.map((m, i) => (
                <div key={i} style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ ...mono, fontSize: 13, color: "var(--accent)" }}>{m.name}</span>
                  <span style={{ ...mono, fontSize: 11.5, color: "var(--dim)", marginLeft: 10 }}>{m.cid}</span>
                </div>
              ))}
            </div>
          </div>
        ) : <Center>군집 선택</Center>
      }
    />
  );
}

// ─── 2단계 충돌 명시 — 호명 중심 그룹 박스 시각 ───
function Stage2ConflictView({ G, route, nav }) {
  const snapTerms = (G.snapshot && G.snapshot.stage1_terms) || {};
  
  // ambiguous_with가 있는 term들을 호명별로 묶기
  const byKey = useMemo(() => {
    const out = {}; // key -> { kind -> [{term_key, name, link, cid}] }
    for (const [cid, terms] of Object.entries(snapTerms)) {
      for (const t of terms) {
        for (const aw of (t.ambiguous_with || [])) {
          const k = aw.key;
          if (!out[k]) out[k] = { same: new Set(), label: new Set(), members: {} };
          const tkid = `${cid}::${t.name}`;
          out[k].members[tkid] = { term_key: tkid, name: t.name, link: t.links[0], cid };
          // 자기 자신을 그룹에 추가
          if (aw.kind === "same_concept_cross_domain") out[k].same.add(tkid);
          else if (aw.kind === "label_collision") out[k].label.add(tkid);
          // with도 추가
          for (const w of (aw.with || [])) {
            if (!out[k].members[w]) {
              const [wcid, wname] = w.split("::");
              const wterms = snapTerms[wcid] || [];
              const wt = wterms.find(x => x.name === wname);
              out[k].members[w] = { term_key: w, name: wname, link: wt ? wt.links[0] : {}, cid: wcid };
            }
            if (aw.kind === "same_concept_cross_domain") out[k].same.add(w);
            else if (aw.kind === "label_collision") out[k].label.add(w);
          }
        }
      }
    }
    // sort
    return Object.entries(out).map(([key, v]) => ({
      key, members: v.members, 
      same: [...v.same], label: [...v.label],
      totalSize: Object.keys(v.members).length
    })).sort((a, b) => b.totalSize - a.totalSize);
  }, [snapTerms]);
  
  const [selKey, setSelKey] = useState(byKey[0] && byKey[0].key);
  const [filter, setFilter] = useState("");
  const [liveResult, setLiveResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  
  async function runOne(keyEntry) {
    setRunning(true); setError(null); setLiveResult(null);
    try {
      // 그 호명의 1.5단계 군집 찾기
      const C = (G.snapshot && G.snapshot.clusters) || { clusters: [] };
      const cluster = C.clusters.find(c => c.key === keyEntry.key);
      if (!cluster) throw new Error("군집을 찾을 수 없음");
      const members = cluster.members.map(m => {
        const cTerms = snapTerms[m.cid] || [];
        const t = cTerms.find(x => x.name === m.name);
        if (!t) return null;
        const l = t.links[0];
        return {
          term_key: m.term_key, name: t.name, synonyms: t.synonyms,
          link: l.type + (l.value ? `='${l.value}'` : "") + (l.column ? ` @ ${l.column}` : ""),
        };
      }).filter(Boolean);
      const userMsg = `호명 키: "${cluster.key}"\n군집 크기: ${members.length}개 term\n\n[군집 멤버]\n${members.map(m => JSON.stringify(m)).join("\n")}\n\n위 군집에 대해 충돌 명시 패치를 JSON 배열로 출력. 충돌 없으면 빈 배열.`;
      const text = await window.LinkAPI.callModel({ system: window.LinkPrompts.STAGE2_CLUSTER, user: userMsg, maxTokens: 4000 });
      const result = window.LinkAPI.parseJSON(text);
      setLiveResult({ key: keyEntry.key, patches: result });
    } catch (e) {
      setError(String(e.message || e));
    }
    setRunning(false);
  }
  
  const filteredKeys = byKey.filter(k => !filter || k.key.includes(filter));
  const selEntry = byKey.find(k => k.key === selKey) || byKey[0];
  
  function GroupBox({ title, members, color, kind }) {
    if (!members || members.length === 0) return null;
    return (
      <div style={{ padding: "10px 12px", border: `1px solid ${color}66`, borderRadius: 5, background: `${color}11`, marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 12, color, marginBottom: 6, fontWeight: 500 }}>{title} · {members.length}개</div>
        {members.map((m, i) => (
          <div key={i} style={{ padding: "5px 6px", marginBottom: 3, background: "rgba(0,0,0,0.2)", borderRadius: 3 }}>
            <div style={{ ...mono, fontSize: 12.5, color: "var(--text)" }}>{m.name}</div>
            <div style={{ ...mono, fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
              {m.link && m.link.type}{m.link && m.link.value && `='${m.link.value}'`} · {m.cid.split(".").slice(1).join(".")}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <TwoPane
      left={
        <div>
          <div style={{ ...mono, fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
            충돌 호명 · {byKey.length}개
          </div>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="호명 검색"
            style={{ width: "100%", ...mono, fontSize: 12.5, padding: "5px 8px", marginBottom: 8,
              background: "var(--panel2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 4 }} />
          {filteredKeys.map(k => (
            <HoverRow key={k.key} active={selKey === k.key} onClick={() => { setSelKey(k.key); setLiveResult(null); }}
              style={{ padding: "4px 8px", borderRadius: 4 }}>
              <div style={{ ...mono, fontSize: 12.5, color: "var(--text)" }}>
                {k.key} <span style={{ color: "var(--dim)" }}>· {k.totalSize}</span>
              </div>
              <div style={{ ...mono, fontSize: 10.5, color: "var(--dim)" }}>
                {k.same.length > 0 && <span style={{ color: "var(--high)" }}>같음·{k.same.length}</span>}
                {k.same.length > 0 && k.label.length > 0 && " · "}
                {k.label.length > 0 && <span style={{ color: "var(--low)" }}>라벨·{k.label.length}</span>}
              </div>
            </HoverRow>
          ))}
        </div>
      }
      right={
        selEntry ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ ...mono, fontSize: 22, color: "var(--text)" }}>"{selEntry.key}"</div>
              <ResultBadge source={liveResult && liveResult.key === selEntry.key ? "live" : "snapshot"} />
              <div style={{ flex: 1 }} />
              <button onClick={() => runOne(selEntry)} disabled={running}
                style={{ ...mono, fontSize: 12, padding: "4px 10px", background: "transparent", color: "var(--sig)",
                  border: "1px solid var(--border)", borderRadius: 4, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.4 : 1 }}>
                {running ? "실행 중…" : "▶ 즉석 실행"}
              </button>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
              이 호명을 공유하는 {selEntry.totalSize}개 term을 LLM이 의미 단위로 갈래잡은 결과입니다. 그룹 박스 안의 link 정보(컬럼·코드값)가 의미 차이를 직접 드러냅니다.
            </div>
            {error && <div style={{ color: "var(--low)", ...mono, fontSize: 12.5, padding: 10, background: "rgba(224,107,94,0.08)", borderRadius: 4, marginBottom: 12 }}>{error}</div>}
            
            {/* 그룹 박스 — 핵심 시각 */}
            <GroupBox
              title="같은 개념 · 도메인 가로지름"
              members={selEntry.same.map(tk => selEntry.members[tk]).filter(Boolean)}
              color="var(--high)"
              kind="same"
            />
            <GroupBox
              title="라벨 일치 · 의미 다름"
              members={selEntry.label.map(tk => selEntry.members[tk]).filter(Boolean)}
              color="var(--low)"
              kind="label"
            />
            
            {liveResult && liveResult.key === selEntry.key && (
              <div style={{ marginTop: 16, padding: "10px 12px", border: "1px dashed var(--sig)", borderRadius: 5 }}>
                <div style={{ ...mono, fontSize: 11.5, color: "var(--sig)", marginBottom: 6 }}>방금 실행 결과 ({liveResult.patches.length}개 패치)</div>
                {liveResult.patches.length === 0 ? <span style={{ ...mono, fontSize: 12, color: "var(--dim)" }}>충돌 없음 — LLM이 의미 충돌 없다고 판단</span> :
                  liveResult.patches.map((p, i) => (
                    <div key={i} style={{ ...mono, fontSize: 12, color: "var(--text)", marginBottom: 2 }}>
                      {p.term_key.split("::")[1]} → "{p.value && p.value.key}" ({p.value && p.value.kind}) with {(p.value && p.value.with || []).length}건
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : <Center>충돌 명시된 호명 없음</Center>
      }
    />
  );
}

// ─── 2단계 의미 격차 보강 — 기존 vs 추가 동의어 대비 ───
function Stage2EnrichView({ G, route, nav }) {
  const snapTerms = (G.snapshot && G.snapshot.stage1_terms) || {};
  const rawTerms = (G.snapshot && G.snapshot.stage1_raw) || {};
  const patches = (G.snapshot && G.snapshot.stage2_patches) || [];
  
  // add_synonyms 패치만, 컬럼별 묶기
  const addPatches = patches.filter(p => p.op === "add_synonyms");
  const byCid = useMemo(() => {
    const out = {};
    for (const p of addPatches) {
      const [cid, name] = p.term_key.split("::");
      if (!out[cid]) out[cid] = [];
      out[cid].push({ name, added: p.value });
    }
    return out;
  }, [patches]);
  
  const cids = Object.keys(byCid).sort();
  const [selCid, setSelCid] = useState(cids[0]);
  const [liveResult, setLiveResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const dc = L.domainColor(G);
  
  async function runOne(cid) {
    setRunning(true); setError(null); setLiveResult(null);
    try {
      const terms = (snapTerms[cid] || []);
      const input = terms.map(t => ({
        term_key: `${cid}::${t.name}`, name: t.name, synonyms: t.synonyms, link: t.links[0],
      }));
      const userMsg = `다음은 한 컬럼의 term들이다. 의미 격차 보강 패치를 출력하라.\n\n${input.map(t => JSON.stringify(t)).join("\n")}\n\nJSON 배열만.`;
      const text = await window.LinkAPI.callModel({ system: window.LinkPrompts.STAGE2_ENRICH, user: userMsg, maxTokens: 2000 });
      const result = window.LinkAPI.parseJSON(text);
      setLiveResult({ cid, patches: result });
    } catch (e) {
      setError(String(e.message || e));
    }
    setRunning(false);
  }
  
  const selTerms = rawTerms[selCid] || [];
  const selAdded = byCid[selCid] || [];
  const addedMap = {};
  for (const a of selAdded) addedMap[a.name] = a.added;
  const isLive = liveResult && liveResult.cid === selCid;
  
  return (
    <TwoPane
      left={
        <div>
          <div style={{ ...mono, fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            의미 격차 보강된 컬럼 ({cids.length}개)
          </div>
          {cids.map(cid => (
            <HoverRow key={cid} active={selCid === cid} onClick={() => { setSelCid(cid); setLiveResult(null); }}
              style={{ padding: "4px 8px", borderRadius: 4 }}>
              <div style={{ ...mono, fontSize: 12.5, color: dc(L.domainOf(tableName(cid))) }}>{colName(cid)}</div>
              <div style={{ ...mono, fontSize: 10.5, color: "var(--dim)" }}>{tableName(cid).split(".")[1]} · +{byCid[cid].length}</div>
            </HoverRow>
          ))}
        </div>
      }
      right={
        selCid ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ ...mono, fontSize: 15, color: "var(--text)" }}>{selCid}</div>
              <ResultBadge source={isLive ? "live" : "snapshot"} />
              <div style={{ flex: 1 }} />
              <button onClick={() => runOne(selCid)} disabled={running}
                style={{ ...mono, fontSize: 12, padding: "4px 10px", background: "transparent", color: "var(--sig)",
                  border: "1px solid var(--border)", borderRadius: 4, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.4 : 1 }}>
                {running ? "실행 중…" : "▶ 즉석 실행"}
              </button>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
              기존 동의어(회색)에 LLM이 추가한 자연어 변형(녹색 +)이 더해집니다. fuzzy로 못 닿는 도메인 약어·별칭이 들어옵니다.
            </div>
            {error && <div style={{ color: "var(--low)", ...mono, fontSize: 12.5, padding: 10, background: "rgba(224,107,94,0.08)", borderRadius: 4, marginBottom: 12 }}>{error}</div>}
            
            {(isLive ? (function() {
              // 즉석 결과를 같은 형태로
              const m = {};
              for (const p of (liveResult.patches || [])) {
                const [_, name] = p.term_key.split("::");
                m[name] = p.value;
              }
              return selTerms.map(t => ({ t, added: m[t.name] }));
            })() : selTerms.map(t => ({ t, added: addedMap[t.name] }))).map(({ t, added }, i) => {
              const l = t.links[0];
              const linkLabel = l.type + (l.value ? `='${l.value}'` : "");
              const linkColor = LINK_COLOR[l.type] || "var(--text)";
              const baseSyns = t.synonyms.filter(s => s !== t.name);
              return (
                <div key={i} style={{ marginBottom: 12, padding: "10px 12px", border: `1px solid ${added ? "var(--high)33" : "var(--border)"}`, borderRadius: 5, background: added ? "rgba(74,201,138,0.05)" : "rgba(0,0,0,0.15)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                    <span style={{ ...mono, fontSize: 14, color: "var(--text)" }}>{t.name}</span>
                    <Badge color={linkColor}>{linkLabel}</Badge>
                  </div>
                  <div style={{ ...mono, fontSize: 12.5, color: "var(--dim)" }}>
                    {baseSyns.join(" · ")}
                  </div>
                  {added && added.length > 0 && (
                    <div style={{ ...mono, fontSize: 12.5, color: "var(--high)", marginTop: 4 }}>
                      + {added.join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
            
            {isLive && (liveResult.patches || []).length === 0 && (
              <div style={{ ...mono, fontSize: 12, color: "var(--dim)" }}>방금 실행 결과: 추가 동의어 없음 — LLM이 의미 격차 없다고 판단</div>
            )}
          </div>
        ) : <Center>컬럼 선택</Center>
      }
    />
  );
}

// 2단계 통합 — 두 종류 탭
function Stage2View({ G, route, nav }) {
  const [tab, setTab] = useState("conflict");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, padding: "10px 24px 0", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
        {[["conflict", "충돌 명시"], ["enrich", "의미 격차 보강"]].map(([k, label]) => (
          <div key={k} onClick={() => setTab(k)}
            style={{ ...mono, fontSize: 13, padding: "5px 12px", cursor: "pointer", borderBottom: tab === k ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === k ? "var(--text)" : "var(--dim)", marginBottom: -1 }}>{label}</div>
        ))}
      </div>
      {tab === "conflict" && <Stage2ConflictView G={G} route={route} nav={nav} />}
      {tab === "enrich" && <Stage2EnrichView G={G} route={route} nav={nav} />}
    </div>
  );
}

// ── 셸 ────────────────────────────────────────────────
const TABS = [["overview", "개요"], ["table", "테이블"], ["surface", "표면형 관찰"]];
const STAGE_TABS = [["stage1", "1단계 · term 생성"], ["stage15", "1.5단계 · 클러스터링"], ["stage2", "2단계 · 충돌·보강"]];
function parseHash() {
  const m = (location.hash || "").match(/^#([a-z0-9]+)(?:\/(.+))?$/);
  if (!m) return { v: "overview", sel: null };
  const vmap = { schema: "table", render: "table", psql: "table", gating: "table", concept: "surface", collision: "surface", column: "table" };
  return { v: vmap[m[1]] || m[1], sel: m[2] ? decodeURIComponent(m[2]) : null };
}
function App({ G }) {
  const [route, setRoute] = useState(parseHash);
  function nav(v, sel, hl) { const r = { v, sel: sel || null, hl: hl || null }; setRoute(r);
    try { history.replaceState(null, "", "#" + v + (sel ? "/" + encodeURIComponent(sel) : "")); } catch (e) {} }
  const props = { G, route, nav };
  const MATERIAL_VIEWS = ["overview", "table", "surface"];
  const STAGE_VIEWS = ["stage1", "stage15", "stage2"];
  const isGate = route.v === "gate";
  const isStage = STAGE_VIEWS.includes(route.v);
  const isMaterial = MATERIAL_VIEWS.includes(route.v);
  
  return (
    <div>
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 16px" }}>
          <span style={{ ...mono, fontSize: 15, color: "var(--accent)", fontWeight: 600, marginRight: 4 }}>Link Agent</span>
          <span style={{ ...mono, fontSize: 12, color: "var(--dim)", marginRight: 10 }}>· 시맨틱 레이어 용어 구축</span>
          {[["재료", isMaterial, "overview"], ["게이트", isGate, "gate"], ["처리", isStage, "stage1"]].map(([lab, active, dest]) => (
            <div key={lab} onClick={() => nav(dest, null)} style={{ ...mono, fontSize: 13.5, padding: "5px 16px", cursor: "pointer", borderRadius: 6,
              background: active ? "rgba(255,255,255,0.1)" : "transparent",
              color: active ? "var(--text)" : "var(--dim)", border: `1px solid ${active ? "var(--border)" : "transparent"}` }}>{lab}</div>))}
          {isStage && <div style={{ flex: 1 }} />}
          {isStage && <KeyAndModel />}
        </div>
        {isMaterial &&
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", padding: "0 24px", background: "rgba(255,255,255,0.02)" }}>
            {TABS.map(([k, label]) => (
              <div key={k} onClick={() => nav(k, null)} style={{ ...mono, fontSize: 14, padding: "7px 14px", cursor: "pointer",
                color: route.v === k ? "var(--text)" : "var(--dim)", borderBottom: route.v === k ? "2px solid var(--accent)" : "2px solid transparent" }}>{label}</div>))}
            <div style={{ flex: 1 }} />
            <div style={{ paddingBottom: 5 }}><SearchBox G={G} nav={nav} /></div>
          </div>}
        {isStage &&
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", padding: "0 24px", background: "rgba(255,255,255,0.02)" }}>
            {STAGE_TABS.map(([k, label]) => (
              <div key={k} onClick={() => nav(k, null)} style={{ ...mono, fontSize: 14, padding: "7px 14px", cursor: "pointer",
                color: route.v === k ? "var(--text)" : "var(--dim)", borderBottom: route.v === k ? "2px solid var(--accent)" : "2px solid transparent" }}>{label}</div>))}
          </div>}
      </div>
      {route.v === "overview" && <Overview {...props} />}
      {route.v === "table" && <TableView {...props} />}
      {route.v === "surface" && <SurfaceView {...props} />}
      {route.v === "gate" && <GateView {...props} />}
      {route.v === "stage1" && <Stage1View {...props} />}
      {route.v === "stage15" && <Stage15View {...props} />}
      {route.v === "stage2" && <Stage2View {...props} />}
    </div>);
}
function Root() {
  const [G, setG] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => {
    const files = ["schema", "render_output", "psql_output", "gate_output"];
    Promise.all(files.map((f) => fetch("data/" + f + ".json").then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); })))
      .then(([schema, render, psql, gate]) => 
        setG({ schema, render, psql, gate, snapshot: window.LinkSnapshot || null })).catch((e) => setErr(String(e.message || e)));
  }, []);
  if (err) return <Center>로드 실패: {err}<br />(http 서버로 실행했는지 확인)</Center>;
  if (!G) return <Center>데이터 적재 중…</Center>;
  return <App G={G} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
