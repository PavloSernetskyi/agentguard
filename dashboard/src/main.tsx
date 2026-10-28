import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownToLine, ArrowRight, Check, ChevronRight, Database, FileUp, Filter, LayoutDashboard, ListFilter, LockKeyhole, Radio, RefreshCw, Search, Shield, ShieldCheck, SlidersHorizontal, Unplug, X } from 'lucide-react';
import { buckets, csv, emptyFilters, filterEvents, fixtures, parseEvents, readImport, summarize, isAuthenticationDenial } from './audit';
import type { AuditEvent, Filters } from './audit';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
import './theme.css';

type View = 'Overview' | 'Audit explorer' | 'Signals' | 'Data sources';
type Dataset = { events: AuditEvent[]; source: 'fixtures' | 'import' | 'live'; label: string; loaded: number; rejected: number; duplicates: number; truncated: boolean };
const initial: Dataset = { events: fixtures(), source: 'fixtures', label: 'Sample audit events', loaded: Date.now(), rejected: 0, duplicates: 0, truncated: false };
const time = (value: string | number) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const label = (value: string) => value.replaceAll('_', ' ');
function Badge({ value }: { value: string }) { return <span className={`badge ${value}`}>{value === 'succeeded' ? 'Succeeded' : value === 'allow' ? 'Allow' : value === 'deny' ? 'Deny' : label(value)}</span>; }
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const [view, setView] = useState<View>('Overview');
  const [data, setData] = useState(initial);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [page, setPage] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [liveToken, setLiveToken] = useState('');
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { const tick = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(tick); }, []);
  useEffect(() => { setPage(0); }, [filters, data]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [view]);
  useEffect(() => {
    if (selected) { previousFocus.current = document.activeElement as HTMLElement; dialogRef.current?.showModal(); }
    else { dialogRef.current?.close(); previousFocus.current?.focus(); }
  }, [selected]);

  async function refresh(token: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const collected: unknown[] = []; let cursor: string | null = null;
      do {
        const res = await fetch('/soc-api/events?limit=500' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (!res.ok) throw new Error(res.status === 401 ? 'Operator access denied. Check your token in Data sources.' : `Reporting feed unavailable (HTTP ${res.status}).`);
        const payload = await res.json();
        if (payload.source !== 'local-sqlite' || !Array.isArray(payload.events) || (payload.next_cursor !== null && typeof payload.next_cursor !== 'string')) throw new Error('The reporting feed returned an unsupported response.');
        collected.push(...payload.events); cursor = payload.next_cursor;
      } while (cursor && collected.length < 5000);
      const parsed = parseEvents(collected.slice(0, 5000));
      if (collected.length && !parsed.events.length) throw new Error('No valid v1 events were received. Check the event schema.');
      if (controller.signal.aborted) return;
      setData({ ...parsed, source: 'live', label: 'Local audit database', loaded: Date.now(), truncated: Boolean(cursor) || collected.length > 5000 });
      setClock(Date.now()); setError('');
    } catch (cause) {
      if (request.current === controller) setError(controller.signal.aborted ? 'Reporting request timed out. Showing the previous snapshot.' : (cause as Error).message + ' Showing the previous snapshot.');
    } finally { clearTimeout(timeout); busyRef.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!liveToken) return;
    void refresh(liveToken);
    const timer = setInterval(() => void refresh(liveToken), 15000);
    return () => { clearInterval(timer); request.current?.abort(); request.current = null; };
  }, [liveToken]);

  const rows = useMemo(() => filterEvents(data.events, filters, clock), [data.events, filters, clock]);
  const stats = useMemo(() => summarize(rows), [rows]);
  const chart = useMemo(() => buckets(rows, filters.hours, clock), [rows, filters.hours, clock]);
  const maxBucket = Math.max(1, ...chart.map(b => b.total));
  const latest = data.events.length ? Math.max(...data.events.map(e => Date.parse(e.timestamp))) : null;
  const actors = [...new Set(data.events.map(e => e.actor_id ?? '__anonymous__'))].sort();
  const actions = [...new Set(data.events.map(e => e.action))].sort();
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters(current => ({ ...current, [key]: value }));
  const visibleRows = rows.slice(page * 12, (page + 1) * 12);
  const pages = Math.max(1, Math.ceil(rows.length / 12));
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose an audit file smaller than 10 MB.');
      const input = readImport(await file.text());
      if (input.length > 50000) throw new Error('Import at most 50,000 event records per snapshot.');
      const parsed = parseEvents(input);
      if (input.length && !parsed.events.length) throw new Error('No valid v1 audit events found. Your current snapshot is unchanged.');
      setLiveToken(''); setTokenInput(''); setSelected(null);
      setData({ ...parsed, source: 'import', label: file.name, loaded: Date.now(), truncated: false });
      setFilters({ ...emptyFilters, hours: 0 }); setError('');
    } catch (cause) { setError((cause as Error).message); }
    if (importRef.current) importRef.current.value = '';
  }
  function restoreFixtures() {
    setLiveToken(''); setTokenInput(''); setSelected(null); setFilters(emptyFilters); setError('');
    setData({ ...initial, events: fixtures(), loaded: Date.now() }); setClock(Date.now());
  }
  const jump = (next: Partial<Filters>) => { setFilters(current => ({ ...current, signal: '', ...next })); setView('Audit explorer'); };
  const nav = [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Audit explorer', icon: ListFilter }, { name: 'Signals', icon: Radio }, { name: 'Data sources', icon: Database }] as const;

  return <div className="app-shell">
    <a className="skip" href="#main">Skip to dashboard</a>
    <aside className="sidebar">
      <a className="brand" aria-label="AgentGuard security overview" href="#" onClick={e => { e.preventDefault(); setView('Overview'); }}><span className="brand-mark"><ShieldCheck size={25} /></span><span>AgentGuard<small>SECURITY OPERATIONS</small></span></a>
      <div className="workspace"><span className="workspace-icon">AP</span><span>Archery Pro<small>Project workspace</small></span><ChevronRight size={16} /></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">{nav.map(({ name, icon: Icon }) => <button key={name} title={name} aria-current={view === name ? 'page' : undefined} className={view === name ? 'active' : ''} onClick={() => setView(name)}><Icon size={18} />{name}{name === 'Signals' && <span className="nav-count">{stats.denied + stats.failed}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="boundary"><LockKeyhole size={17} /><strong>Read-only workspace</strong><p>Inspect decisions and execution evidence.</p></div><div className="operator"><span>03</span><div>Person 3<small>SOC Dashboard owner</small></div></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div>Workspace <ChevronRight size={13} /><strong>{view}</strong></div><span className="top-status"><span className={`dot ${data.source === 'live' && !error ? 'green' : 'amber'}`} />{data.source === 'fixtures' ? 'Fixture preview' : data.source === 'import' ? 'Imported snapshot' : error ? 'Feed needs attention' : 'Local feed connected'}</span></header>
      <main id="main">
        <div className="page-heading"><div><p className="eyebrow">AGENTGUARD / SOC</p><h1>{view === 'Overview' ? 'Security overview' : view}</h1><p className="subtitle">{view === 'Overview' ? 'Every decision. Every outcome. One place to investigate.' : view === 'Audit explorer' ? 'Follow each request from authorization to execution.' : view === 'Signals' ? 'Review observable conditions in the current event selection.' : 'Choose the evidence behind your dashboard.'}</p></div><div className="heading-actions"><button className="button" onClick={() => importRef.current?.click()}><FileUp size={16} />Import events</button><button className="button primary" disabled={!rows.length} onClick={() => download('agentguard-filtered-events.csv', csv(rows), 'text/csv;charset=utf-8')}><ArrowDownToLine size={16} />Export CSV</button></div></div>
        <input ref={importRef} className="visually-hidden" aria-label="Import audit JSON or NDJSON" type="file" accept=".json,.jsonl,.ndjson,application/json" onChange={e => void importFile(e.target.files?.[0])} />
        <div className={`source-banner ${data.source === 'fixtures' ? 'sample' : ''}`}><div><span className="source-icon"><Database size={17} /></span><span><strong>{data.source === 'fixtures' ? 'Sample data · Preview only' : data.source === 'import' ? 'Imported evidence · Static snapshot' : 'Local evidence · Read-only feed'}</strong><small>{data.source === 'fixtures' ? '64 synthetic audit fixtures. These are not recorded attacks or production activity.' : `${data.label} · Updated ${time(data.loaded)} · ${data.source === 'live' ? 'Polls every 15 seconds' : 'No automatic refresh'}`}</small></span></div><button className="text-button" onClick={() => setView('Data sources')}>Manage source <ArrowRight size={15} /></button></div>
        {error && <div role="alert" className="notice error">{error}</div>}
        {(data.rejected > 0 || data.duplicates > 0 || data.truncated) && <div role="status" className="notice">{data.rejected} invalid records excluded · {data.duplicates} duplicate IDs excluded.{data.truncated && ' Snapshot capped at 5,000 records; metrics cover loaded events only.'}</div>}
        {view !== 'Data sources' && <>
          <section className="filterbar" aria-label="Event filters"><div className="filter-title"><SlidersHorizontal size={16} /><strong>Filters</strong></div><label className="searchbox"><Search size={16} /><input aria-label="Search events" placeholder="Search events, resources, request IDs…" value={filters.search} onChange={e => setFilter('search', e.target.value)} /></label><label className="visually-hidden" htmlFor="time-window">Time window</label><select id="time-window" value={filters.hours} onChange={e => setFilter('hours', Number(e.target.value))}><option value={24}>Last 24 hours</option><option value={168}>Last 7 days</option><option value={0}>All loaded events</option></select><button title="Refresh local feed" aria-label="Refresh local feed" className="icon-button" disabled={!liveToken || busy} onClick={() => void refresh(liveToken)}><RefreshCw size={16} className={busy ? 'spin' : ''} /></button></section>
          <div className="secondary-filters"><select aria-label="Actor" value={filters.actor} onChange={e => setFilter('actor', e.target.value)}><option value="">All actors</option>{actors.map(actor => <option key={actor} value={actor}>{actor === '__anonymous__' ? 'Unauthenticated' : actor}</option>)}</select><select aria-label="Action" value={filters.action} onChange={e => setFilter('action', e.target.value)}><option value="">All actions</option>{actions.map(action => <option key={action}>{action}</option>)}</select><select aria-label="Decision" value={filters.decision} onChange={e => setFilter('decision', e.target.value)}><option value="">All decisions</option><option value="allow">Allow</option><option value="deny">Deny</option></select><select aria-label="Execution" value={filters.execution} onChange={e => setFilter('execution', e.target.value)}><option value="">All executions</option><option value="succeeded">Succeeded</option><option value="blocked">Blocked</option><option value="failed">Failed</option></select><button className="text-button" onClick={() => setFilters({ ...emptyFilters, hours: data.source === 'import' ? 0 : 24 })}>Reset filters</button><span>{filters.signal && 'Authentication denials · '}{rows.length} of {data.events.length} loaded events</span></div>
        </>}
        {view === 'Overview' && <>
          <section className="metric-grid" aria-label="Key metrics">
            <article className="metric"><div><span>Total audit events</span><Activity size={18} /></div><strong>{stats.total.toLocaleString()}</strong><p>{stats.uniqueRequests} requests · {stats.uniqueActors} authenticated actors</p></article>
            <article className="metric"><div><span>Authorization denials</span><Shield size={18} /></div><strong>{stats.denied}<small className="deny-text">{percent(stats.denyRate)}</small></strong><p>Denied events / all selected events</p></article>
            <article className="metric"><div><span>Execution success</span><ShieldCheck size={18} /></div><strong>{percent(stats.executionSuccessRate)}</strong><p>{stats.succeeded} succeeded / {stats.allowed} allowed events</p></article>
            <article className="metric"><div><span>Execution failures</span><Activity size={18} /></div><strong>{stats.failed}<small className="fail-text">{percent(stats.executionFailureRate)}</small></strong><p>Failed executions / allowed events</p></article>
          </section>
          <div className="chart-grid">
            <section className="panel traffic"><div className="panel-heading"><div><h2>Execution activity</h2><p>Event volume across the selected time window</p></div><span className="pill">{filters.hours ? `${filters.hours}h window` : 'Loaded history'}</span></div><div className="legend"><span><i className="success-color" />Succeeded</span><span><i className="blocked-color" />Blocked</span><span><i className="failed-color" />Failed</span></div><div className="chart" role="img" aria-label={`Execution activity: ${stats.succeeded} succeeded, ${stats.blocked} blocked and ${stats.failed} failed events.`}><div className="chart-scale"><span>{maxBucket}</span><span>{Math.round(maxBucket / 2)}</span><span>0</span></div><div className="bars">{chart.map((bucket, index) => <div className="bar-slot" key={bucket.start}><div className="bar-stack" title={`${time(bucket.start)}: ${bucket.total} events`} style={{ height: `${bucket.total / maxBucket * 100}%` }}>{(['succeeded', 'blocked', 'failed'] as const).map(outcome => <span key={outcome} className={`${outcome}-bar`} style={{ height: `${bucket.total ? bucket[outcome] / bucket.total * 100 : 0}%` }} />)}</div><span className="bar-label">{index % 3 === 0 ? new Date(bucket.start).toLocaleString([], filters.hours === 24 ? { hour: 'numeric' } : { month: 'short', day: 'numeric', hour: 'numeric' }) : ''}</span></div>)}</div></div></section>
            <section className="panel"><div className="panel-heading"><div><h2>Denial reasons</h2><p>Why authorization was refused</p></div><Shield size={18} /></div><div className="reason-list">{stats.reasons.length ? stats.reasons.slice(0, 5).map(([reason, count]) => <button key={reason} onClick={() => jump({ search: reason, decision: 'deny' })}><span>{label(reason)}<strong>{count}</strong></span><span className="reason-track"><i style={{ width: `${count / stats.denied * 100}%` }} /></span></button>) : <p className="empty-small">No authorization denials in this selection.</p>}</div><p className="panel-footnote">A denial records a blocked request; it does not establish malicious intent.</p></section>
          </div>
          <section className="panel matrix-panel"><div className="panel-heading"><div><h2>Decision × execution matrix</h2><p>Authorization and execution answer different questions.</p></div><span className="pill">v1 event contract</span></div><div className="table-scroll"><table className="matrix"><thead><tr><th>Authorization</th><th>Succeeded</th><th>Blocked</th><th>Failed</th></tr></thead><tbody>{['allow', 'deny'].map((decision, index) => <tr key={decision}><th><Badge value={decision} /></th>{['succeeded', 'blocked', 'failed'].map((execution, column) => <td key={execution}><button disabled={!stats.matrix[index][column]} onClick={() => jump({ decision, execution })}>{stats.matrix[index][column]}<small>{decision === 'deny' && execution !== 'blocked' ? 'Invalid in v1' : decision === 'allow' && execution === 'succeeded' ? 'Authorized and completed' : decision === 'deny' ? 'Prevented execution' : execution === 'failed' ? 'Authorized; operation failed' : 'Allowed; not executed'}</small></button></td>)}</tr>)}</tbody></table></div></section>
        </>}
        {(view === 'Overview' || view === 'Audit explorer') && <section className="panel event-panel"><div className="panel-heading"><div><h2>{view === 'Overview' ? 'Recent audit events' : 'Event timeline'}</h2><p>All timestamps use your browser’s local timezone.</p></div>{view === 'Overview' && <button className="text-button" onClick={() => setView('Audit explorer')}>Open explorer <ArrowRight size={15} /></button>}</div><div className="table-scroll"><table className="events"><thead><tr><th>Time</th><th>Actor / action</th><th>Resource</th><th>Decision</th><th>Execution</th><th><span className="visually-hidden">Details</span></th></tr></thead><tbody>{visibleRows.map(event => <tr key={event.event_id}><td><span className="event-time">{time(event.timestamp)}</span><small>{new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></td><td><strong>{event.actor_id ?? 'Unauthenticated'}</strong><small className="mono">{event.action}</small></td><td><span className="mono resource">{event.resource_id}</span><small>{label(event.reason)}</small></td><td><Badge value={event.decision} /></td><td><Badge value={event.execution} /></td><td><button className="icon-button" aria-label={`View event ${event.event_id}`} onClick={() => setSelected(event)}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{!rows.length && <div className="empty"><Filter size={28} /><h3>No matching events</h3><p>Change the filters, import evidence, or connect the local feed.</p></div>}</div><div className="pagination"><span>{rows.length ? page * 12 + 1 : 0}–{Math.min((page + 1) * 12, rows.length)} of {rows.length} events</span><div><button className="button" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {Math.min(page + 1, pages)} / {pages}</span><button className="button" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Next</button></div></div></section>}
        {view === 'Signals' && <section className="panel signals"><div className="panel-heading"><div><h2>Conditions to review</h2><p>Derived observations, not confirmed incidents. Counts follow the active filters.</p></div><Radio size={20} /></div>{[{ title: 'Ownership mismatches', description: 'Requests denied because the authenticated actor did not own the resource.', events: rows.filter(e => e.reason === 'ownership_mismatch'), filter: { search: 'ownership_mismatch', decision: 'deny' } }, { title: 'Authentication denials', description: 'Invalid sessions, invalid credentials, or unavailable identity provider.', events: rows.filter(isAuthenticationDenial), filter: { search: 'session', decision: 'deny' } }, { title: 'Allowed operations that failed', description: 'Authorization succeeded, but the application operation failed.', events: rows.filter(e => e.decision === 'allow' && e.execution === 'failed'), filter: { decision: 'allow', execution: 'failed' } }].map(signal => <article className="signal" key={signal.title}><span className="signal-icon"><Activity size={19} /></span><div><h3>{signal.title}</h3><p>{signal.description}</p></div><strong>{signal.events.length}</strong><button className="button" onClick={() => { if (signal.title === 'Authentication denials') { setFilters(current => ({ ...current, search: '', decision: 'deny', action: '', execution: '', actor: '', signal: 'authentication' })); setView('Audit explorer'); } else jump(signal.filter); }}>Review <ArrowRight size={14} /></button></article>)}<p className="panel-footnote">Detection precision, attack success, and response times require labeled scenarios and an incident workflow. They are deferred.</p></section>}
        {view === 'Data sources' && <div className="source-grid"><section className="panel"><div className="panel-heading"><div><h2>Connect local audit feed</h2><p>Operator access is separate from Alice/Bob shopper accounts.</p></div><LockKeyhole size={20} /></div><p className="body-copy">Start the read-only reporting server, then enter its operator token. The token stays in memory and is cleared when the page reloads or you disconnect.</p><pre>python -m backend.soc</pre><form onSubmit={e => { e.preventDefault(); if (tokenInput.length < 32) { setError('Use the operator token configured for the reporting server (at least 32 characters).'); return; } if (busy) return; if (liveToken === tokenInput) void refresh(liveToken); else setLiveToken(tokenInput); }}><label htmlFor="operator-token">Operator token</label><input id="operator-token" type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Paste local operator token" /><div className="form-actions"><button className="button primary" disabled={busy} type="submit"><Database size={16} />{busy ? 'Connecting…' : 'Connect feed'}</button>{liveToken && <button type="button" className="button" onClick={() => { setLiveToken(''); setTokenInput(''); setData(current => ({ ...current, source: 'import', label: 'Disconnected local snapshot' })); setError(''); }}><Unplug size={16} />Disconnect</button>}</div></form><p className="panel-footnote">Feed: /soc-api/events · Read-only · Maximum 5,000 loaded events. Cloud operator authentication and hosting are a separate deployment gate.</p></section><section className="panel"><div className="panel-heading"><div><h2>Work with an audit snapshot</h2><p>Inspect evidence without connecting to AWS.</p></div><FileUp size={20} /></div><div className="import-zone"><FileUp size={32} /><h3>Import JSON or NDJSON</h3><p>v1 events, reporting envelopes, or plain DynamoDB rows with a value payload. Up to 10 MB / 50,000 records.</p><button className="button" onClick={() => importRef.current?.click()}>Choose audit file</button></div><div className="source-option"><div><strong>Explore fixture data</strong><p>Reset to clearly labeled synthetic sample events.</p></div><button className="button" onClick={restoreFixtures}>Load fixtures</button></div></section><section className="panel full-width"><div className="panel-heading"><div><h2>Data quality and coverage</h2><p>Metrics describe the loaded, filtered events only.</p></div><Check size={20} /></div><div className="quality-grid"><div><span>Valid events</span><strong>{data.events.length}</strong></div><div><span>Invalid records excluded</span><strong>{data.rejected}</strong></div><div><span>Duplicate IDs excluded</span><strong>{data.duplicates}</strong></div><div><span>Newest event</span><strong className="quality-time">{latest === null ? 'No events' : new Date(latest).toLocaleString()}</strong></div></div><p className="panel-footnote">Deduplication uses event_id. Unknown fields and invalid v1 decision/outcome pairs are rejected. Newest-event age is evidence freshness, not ingestion latency or a completeness guarantee.</p></section></div>}
        <footer><span><ShieldCheck size={14} />AgentGuard SOC <span className="footer-divider">/</span> {data.source === 'fixtures' ? 'Synthetic fixtures' : 'Audit evidence'} <span className="footer-divider">/</span> Read-only</span><span>Schema v1 · {data.events.length} valid events loaded</span></footer>
      </main>
    </div>
    <dialog ref={dialogRef} aria-labelledby="event-title" onCancel={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      {selected && <><div className="detail-heading"><div><p className="eyebrow">AUDIT EVIDENCE</p><h2 id="event-title">Event details</h2></div><button className="icon-button" aria-label="Close event details" onClick={() => setSelected(null)}><X size={20} /></button></div><div className="detail-summary"><Badge value={selected.decision} /><ArrowRight size={16} /><Badge value={selected.execution} /></div><dl>{Object.entries(selected).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{value === null ? 'Unauthenticated' : String(value)}</dd></div>)}</dl><button className="button" onClick={() => { jump({ ...emptyFilters, hours: 0, search: selected.request_id }); setSelected(null); }}>Show correlated request <ArrowRight size={15} /></button><button className="button detail-export" onClick={() => download(`event-${selected.event_id}.json`, JSON.stringify(selected, null, 2), 'application/json')}>Export event JSON</button></>}
    </dialog>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
