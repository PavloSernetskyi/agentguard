import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, Bot, ArrowDownToLine, ArrowRight, Check, ChevronDown, ChevronRight, Database, FileUp, Filter, LayoutDashboard, ListFilter, LockKeyhole, Radio, RefreshCw, Search, Shield, ShieldAlert, ShieldCheck, Unplug, X } from 'lucide-react';
import { buckets, csv, emptyFilters, filterEvents, fixtures, parseEvents, readImport, summarize, isAuthenticationDenial, isOwnershipDenial, assistantRequests, investigationLink, requestFromSearch, eventOutcome, requestOutcome, breachedAccounts, windowLabel } from './audit';
import type { AuditEvent, Filters } from './audit';
import { presentationOrderAccess } from './comparison';
import { orderSignal, orderSignalLabel, eventRowClass } from './orderSignal';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
import './theme.css';
import './responsive.css';

type View = 'Overview' | 'Assistant requests' | 'Audit explorer' | 'Signals' | 'Data sources';
const cloud = import.meta.env.VITE_SOC_MODE === 'cloud';
type Dataset = { events: AuditEvent[]; source: 'fixtures' | 'import' | 'live'; label: string; loaded: number; rejected: number; duplicates: number; truncated: boolean };
const initialRequest = requestFromSearch(location.search);
const initial: Dataset = { events: fixtures(), source: 'fixtures', label: 'Sample audit events', loaded: Date.now(), rejected: 0, duplicates: 0, truncated: false };
const time = (value: string | number) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const label = (value: string) => value.replaceAll('_', ' ');
const reasonLabels = new Map([
  ['ownership_mismatch', 'Another customer’s data'],
  ['conversation_ownership_mismatch', 'Another customer’s chat'],
  ['owner_match', 'Own data'],
  ['invalid_session', 'Sign-in required'],
  ['invalid_credentials', 'Sign-in failed'],
  ['identity_provider_unavailable', 'Sign-in service unavailable'],
  ['demo_ownership_check_disabled', 'Classroom demo'],
  ['credentials_valid', 'Signed in'],
]);
const reasonText = (value: string) => reasonLabels.get(value) ?? label(value);
function Badge({ value }: { value: string }) { return <span className={`badge ${value}`}>{value === 'succeeded' ? 'Succeeded' : value === 'failed' ? 'Error' : value === 'allow' ? 'Allowed' : value === 'deny' ? 'Denied' : label(value)}</span>; }
function EventOutcome({event}: {event: AuditEvent}) {
  return eventOutcome(event) === 'breach'
    ? <span className="badge breach">Data breach</span>
    : <Badge value={event.execution}/>;
}
function MetricCard({title, count, total, tone, description, icon: Icon}: {title: string; count: number; total: number; tone: string; description: string; icon: typeof Activity}) {
  return <article className="metric"><div><span>{title}</span><Icon size={18}/></div><strong className="metric-value"><span className="metric-count" key={`${count}/${total}`}>{count.toLocaleString()}<span className="metric-total"> / {total.toLocaleString()}</span></span><small className={`metric-rate ${tone}`}>{percent(total ? count / total : null)}</small></strong><p>{description}</p></article>;
}
const pageSizes = [12, 25, 50, 100];
function Pagination({count, page, pageSize, noun, setPage, setPageSize}: {count: number; page: number; pageSize: number; noun: 'events' | 'requests'; setPage: (page: number) => void; setPageSize: (size: number) => void}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return <div className="pagination"><span>{count ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, count)} of {count} {noun}</span><div className="pagination-controls"><label className="page-size"><span>{noun === 'events' ? 'Events' : 'Requests'} per page</span><select aria-label={noun === 'events' ? 'Events per page' : 'Requests per page'} value={pageSize} onChange={event => {const size = Number(event.target.value); if (pageSizes.includes(size)) {setPage(0); setPageSize(size);}}}>{pageSizes.map(size => <option key={size} value={size}>{size}</option>)}</select></label>{pages > 1 && <div className="page-navigation"><button className="button" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} / {pages}</span><button className="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}</div></div>;
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App({onUnauthorized, onSignOut}: {onUnauthorized?: () => void; onSignOut?: () => void}) {
  const [view, setView] = useState<View>(initialRequest ? 'Audit explorer' : 'Overview');
  const [data, setData] = useState<Dataset>(cloud ? {...initial, events: [], source: 'live', label: 'AWS audit feed'} : initial);
  const [filters, setFilters] = useState<Filters>(initialRequest ? {...emptyFilters, hours: 0, search: initialRequest} : emptyFilters);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [demoStartedAt, setDemoStartedAt] = useState(() => Number(localStorage.getItem('agentguard-presentation-start') || 0));
  const [busy, setBusy] = useState(false);
  const activeDemoStart = data.source === 'live' ? demoStartedAt : 0;
  const [tokenInput, setTokenInput] = useState('');
  const [liveToken, setLiveToken] = useState(cloud ? 'cloud-session' : '');
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const originalSource = useRef<{data: Dataset; token: string} | null>(null);
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { const tick = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(tick); }, []);
  useEffect(() => { setPage(0); }, [filters, data.source, view, activeDemoStart, pageSize]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [view]);
  useEffect(() => {
    setCopyStatus('');
    if (selected && !dialogRef.current?.open) { previousFocus.current = document.activeElement as HTMLElement; dialogRef.current?.showModal(); }
    else if (!selected) { dialogRef.current?.close(); previousFocus.current?.focus(); }
  }, [selected]);

  async function refresh(token: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const collected: unknown[] = []; let cursor: string | null = null;
      do {
        const res: Response = await fetch('/soc-api/events?limit=500' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: cloud ? {} : { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: cloud ? 'include' : 'omit', signal: controller.signal });
        if (res.status === 401 && cloud) { onUnauthorized?.(); return; }
        if (!res.ok) throw new Error(res.status === 401 ? 'Operator access denied. Check your token in Data sources.' : `Reporting feed unavailable (HTTP ${res.status}).`);
        const payload: { source: unknown; events: unknown; next_cursor: unknown } = await res.json();
        if (payload.source !== (cloud ? 'cloud-dynamodb' : 'local-sqlite') || !Array.isArray(payload.events) || (payload.next_cursor !== null && typeof payload.next_cursor !== 'string')) throw new Error('The reporting feed returned an unsupported response.');
        collected.push(...payload.events); cursor = payload.next_cursor as string | null;
      } while (cursor && collected.length < 5000);
      const parsed = parseEvents(collected.slice(0, 5000));
      if (collected.length && !parsed.events.length) throw new Error('No valid v1 events were received. Check the event schema.');
      if (controller.signal.aborted) return;
      setData({ ...parsed, source: 'live', label: cloud ? 'AWS audit feed' : 'Local audit database', loaded: Date.now(), truncated: Boolean(cursor) || collected.length > 5000 });
      setHasSnapshot(true); setClock(Date.now()); setError('');
    } catch (cause) {
      if (request.current === controller) setError(controller.signal.aborted ? 'Reporting request timed out. Showing the previous snapshot.' : (cause as Error).message + ' Showing the previous snapshot.');
    } finally { clearTimeout(timeout); busyRef.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!liveToken) return;
    void refresh(liveToken);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(liveToken); }, 15000);
    return () => { clearInterval(timer); request.current?.abort(); request.current = null; };
  }, [liveToken]);

  const demoEvents = useMemo(() => activeDemoStart
    ? data.events.filter(event => Date.parse(event.timestamp) >= activeDemoStart)
    : data.events, [data.events, activeDemoStart]);
  const rows = useMemo(() => filterEvents(demoEvents, filters, clock), [demoEvents, filters, clock]);
  const stats = useMemo(() => summarize(rows), [rows]);
  const signalStats = summarize(demoEvents);
  const demoAccesses = demoEvents.filter(event => orderSignal(event) === 'exposed-order-access').length;
  const requests = useMemo(() => assistantRequests(filterEvents(demoEvents, {...filters, outcome: ''}, clock), demoEvents)
    .filter(trace => !filters.outcome || requestOutcome(trace) === filters.outcome), [demoEvents, filters, clock]);
  const requestCounts = {succeeded: 0, breach: 0, blocked: 0, failed: 0};
  requests.forEach(trace => requestCounts[requestOutcome(trace)]++);
  const successfulEvents = rows.filter(event => eventOutcome(event) === 'succeeded').length;
  const breachAccounts = breachedAccounts(rows);
  const breachCount = breachAccounts.reduce((total, account) => total + account.count, 0);
  const relatedEvents = selected ? data.events.filter(event => event.request_id === selected.request_id) : [];
  const importedFile = data.source === 'import' && originalSource.current !== null;

  const chart = useMemo(() => buckets(rows, filters.hours, clock), [rows, filters.hours, clock]);
  const maxBucket = Math.max(1, ...chart.map(b => b.total));
  const exposedChartCount = chart.reduce((total, bucket) => total + bucket.exposed, 0);
  const latest = data.events.length ? Math.max(...data.events.map(e => Date.parse(e.timestamp))) : null;
  const actors = [...new Set(demoEvents.map(e => e.actor_id ?? '__anonymous__'))].sort();
  const actions = [...new Set(demoEvents.map(e => e.action))].sort();
  const { bobBlocked, aliceAllowed } = presentationOrderAccess(demoEvents, activeDemoStart);
  const startPresentation = () => { const now = Date.now(); localStorage.setItem('agentguard-presentation-start', String(now)); setDemoStartedAt(now); setFilters(emptyFilters); };
  const showFullHistory = () => { localStorage.removeItem('agentguard-presentation-start'); setDemoStartedAt(0); setFilters(emptyFilters); };
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters(current => ({ ...current, [key]: value }));
  const displayRows = rows;
  const visibleRows = displayRows.slice(page * pageSize, (page + 1) * pageSize);
  useEffect(() => {
    const count = view === 'Assistant requests' ? requests.length : displayRows.length;
    setPage(current => Math.min(current, Math.max(0, Math.ceil(count / pageSize) - 1)));
  }, [view, requests.length, displayRows.length, pageSize]);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose an audit file smaller than 10 MB.');
      const input = readImport(await file.text());
      if (input.length > 50000) throw new Error('Import at most 50,000 event records per snapshot.');
      const parsed = parseEvents(input);
      if (input.length && !parsed.events.length) throw new Error('No valid v1 audit events found. Your current snapshot is unchanged.');
      if (!originalSource.current) originalSource.current = {data, token: liveToken};
      request.current?.abort(); request.current = null;
      setLiveToken(''); setTokenInput(''); setSelected(null);
      setData({ ...parsed, source: 'import', label: file.name, loaded: Date.now(), truncated: false });
      setFilters({ ...emptyFilters, hours: 0, search: initialRequest && filters.search === initialRequest ? initialRequest : '' }); setError('');
    } catch (cause) { setError((cause as Error).message); }
    if (importRef.current) importRef.current.value = '';
  }
  function restoreFixtures() {
    originalSource.current = null;
    setLiveToken(''); setTokenInput(''); setSelected(null); setFilters(emptyFilters); setError('');
    setData({ ...initial, events: fixtures(), loaded: Date.now() }); setClock(Date.now());
  }
  function restoreOriginalSource() {
    const previous = originalSource.current;
    if (!previous) return;
    originalSource.current = null;
    setSelected(null); setCopyStatus(''); setError(''); setFilters(emptyFilters);
    setData(previous.data); setLiveToken(previous.token); setClock(Date.now());
  }
  const jump = (next: Partial<Filters>) => { setFilters(current => ({ ...current, signal: '', ...next })); setView('Audit explorer'); };
  const navigate = (next: View) => {
    if (next !== 'Audit explorer') setFilters(current => ({...current, action: '', decision: '', signal: ''}));
    setView(next);
  };
  const hasFilters = Boolean(filters.search || filters.actor || filters.action || filters.decision || filters.execution || filters.outcome || filters.signal || filters.hours !== (data.source === 'import' ? 0 : 24));
  const resetFilters = () => setFilters({...emptyFilters, hours: data.source === 'import' ? 0 : 24});
  const nav = [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Audit explorer', icon: ListFilter }, { name: 'Assistant requests', icon: Bot }, { name: 'Signals', icon: Radio }, { name: 'Data sources', icon: Database }] as const;

  return <div className={`app-shell${cloud ? ' cloud-mode' : ''}`}>
    <a className="skip" href="#main">Skip to dashboard</a>
    <aside className="sidebar">
      <a className="brand" aria-label="AgentGuard security overview" href="#" onClick={e => { e.preventDefault(); navigate('Overview'); }}><span className="brand-mark"><ShieldCheck size={25} /></span><span>AgentGuard<small>SECURITY OPERATIONS</small></span></a>
      <div className="workspace"><span className="workspace-icon">AP</span><span>Archery Pro<small>Project workspace</small></span></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">{nav.map(({ name, icon: Icon }) => <button key={name} title={name} aria-label={name} aria-current={view === name ? 'page' : undefined} className={view === name ? 'active' : ''} onClick={() => navigate(name)}><Icon size={18} />{name}{name === 'Signals' && <span className="nav-count">{signalStats.denied + signalStats.failed + demoAccesses}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="boundary"><LockKeyhole size={17} /><strong>Read-only workspace</strong><p>View recorded activity.</p></div><div className="operator"><span>03</span><div>Person 3<small>SOC Dashboard owner</small></div></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div>Workspace <ChevronRight size={13} /><strong>{view}</strong></div><div className="feed-controls"><span className="top-status"><span className={`dot ${data.source === 'live' && hasSnapshot && !error ? 'green' : 'amber'}`} />{data.source === 'fixtures' ? 'Sample events' : data.source === 'import' ? 'Imported snapshot' : error ? 'Feed unavailable' : !hasSnapshot ? 'Connecting to feed…' : cloud ? 'AWS feed connected' : 'Local feed connected'}</span>{liveToken && <button className="button refresh-feed" onClick={() => void refresh(liveToken)} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''}/>{busy ? 'Refreshing…' : 'Refresh'}</button>}</div></header>
      <main id="main">
        <div className="page-heading"><div><p className="eyebrow">AGENTGUARD / SOC</p><h1>{view === 'Overview' ? 'Security overview' : view}</h1><p className="subtitle">{view === 'Overview' ? 'See successful actions, blocked attempts, data breaches and errors.' : view === 'Audit explorer' ? 'Review recorded events and open their details.' : view === 'Assistant requests' ? 'See the assistant’s requests and recorded actions.' : view === 'Signals' ? 'Show what was blocked and what got through.' : 'Connect a feed or open an event file.'}</p></div>{view === 'Audit explorer' && rows.length > 0 && <div className="heading-actions"><button className="button primary" onClick={() => download('agentguard-filtered-events.csv', csv(rows), 'text/csv;charset=utf-8')}><ArrowDownToLine size={16} />Export events</button></div>}</div>
        <input ref={importRef} hidden aria-label="Import audit JSON or NDJSON" type="file" accept=".json,.jsonl,.ndjson,application/json" onChange={e => void importFile(e.target.files?.[0])} />
        <div className={`source-banner compact-source ${data.source === 'fixtures' ? 'sample' : ''}`}><div><span className="source-icon"><Database size={16}/></span><span className="source-copy"><strong>{data.source === 'fixtures' ? 'Sample data' : data.source === 'import' ? 'Snapshot' : cloud ? 'Live AWS feed' : 'Local feed'}</strong><small title={data.source === 'import' ? data.label : undefined}>{data.source === 'fixtures' ? 'Practice only' : data.source === 'import' ? data.label : !hasSnapshot ? 'Connecting…' : `Updated ${time(data.loaded)} · 15s refresh`}</small></span></div></div>
        {importedFile && <div className="notice snapshot-notice" role="status"><span>Viewing an event file. The original feed is paused; nothing is saved to it.</span><button className="button" onClick={restoreOriginalSource}>{originalSource.current?.token ? 'Return to live feed' : 'Return to original data'}</button></div>}
        {activeDemoStart > 0 && <div className="notice demo-view-notice compact-demo" role="status"><span title={`Demo started ${new Date(activeDemoStart).toLocaleString()}`}>Demo view · {data.events.length - demoEvents.length} earlier events hidden</span><button className="text-button" onClick={showFullHistory}>Show full history</button></div>}
        {error && <div role="alert" className="notice error">{error}</div>}
        {(data.rejected > 0 || data.duplicates > 0 || data.truncated) && <div role="status" className="notice">{data.rejected} invalid records excluded · {data.duplicates} duplicate IDs excluded.{data.truncated && ' Snapshot capped at 5,000 records; metrics cover loaded events only.'}</div>}
        {['Overview', 'Audit explorer', 'Assistant requests'].includes(view) && <section className="filters-panel" aria-label="Event filters">
          <div className="filterbar">
            <label className="searchbox"><Search size={16}/><input aria-label="Search events" placeholder="Search events or request IDs" value={filters.search} onChange={event => setFilter('search', event.target.value)}/></label>
            <label className="filter-field"><span>Time</span><select aria-label="Time range" value={filters.hours} onChange={event => setFilter('hours', Number(event.target.value))}><option value={1}>Last 60 minutes</option><option value={24}>Last 24 hours</option><option value={168}>Last 7 days</option><option value={0}>All history</option></select></label>
            <label className="filter-field"><span>Person</span><select aria-label="Person" value={filters.actor} onChange={event => setFilter('actor', event.target.value)}><option value="">Everyone</option>{actors.map(actor => <option key={actor} value={actor}>{actor === '__anonymous__' ? 'Not signed in' : actor}</option>)}</select></label>
            <label className="filter-field"><span>Outcome</span><select aria-label="Outcome" value={filters.outcome} onChange={event => setFilters(current => ({...current, outcome: event.target.value, execution: '', signal: ''}))}><option value="">All outcomes</option><option value="succeeded">Succeeded</option><option value="breach">Data breach</option><option value="blocked">Blocked</option><option value="failed">Error</option></select></label>
            {hasFilters && <button className="text-button" onClick={resetFilters}>Clear filters</button>}
          </div>
          <div className="filter-summary"><span>{view === 'Assistant requests' ? `${requests.length} requests shown` : `${rows.length} events shown`}{filters.signal === 'authentication' ? ' · Sign-in problems' : filters.decision ? ` · ${filters.decision === 'deny' ? 'Access denied' : 'Access allowed'}` : ''}</span></div>
          {view === 'Audit explorer' && <div className="advanced-filters"><button type="button" className="text-button" aria-expanded={advancedOpen} aria-controls="advanced-options" onClick={() => setAdvancedOpen(open => !open)}><ChevronDown size={16} className={advancedOpen ? 'expanded-chevron' : ''}/>Advanced filters{(filters.action || filters.decision) && <span className="pill">Active</span>}</button><div id="advanced-options" className={`advanced-region ${advancedOpen ? 'open' : ''}`} aria-hidden={!advancedOpen}><div className="advanced-content"><div className="advanced-fields"><label className="filter-field"><span>Action</span><select aria-label="Action" disabled={!advancedOpen} value={filters.action} onChange={event => setFilter('action', event.target.value)}><option value="">All actions</option>{actions.map(action => <option key={action}>{action}</option>)}</select></label><label className="filter-field"><span>Decision</span><select aria-label="Decision" disabled={!advancedOpen} value={filters.decision} onChange={event => setFilter('decision', event.target.value)}><option value="">All decisions</option><option value="allow">Allowed</option><option value="deny">Denied</option></select></label></div></div></div></div>}
        </section>}
        {view === 'Signals' && <section className="panel comparison-panel" aria-label="Bob and Alice order access comparison">
          <div className="panel-heading"><div><h2>Order access: Bob and Alice</h2><p>{data.source === 'live' ? 'Follow the two attempts in this demo.' : 'Practice view using sample or imported events.'}</p></div></div>
          <div className="comparison-grid">
            <div className={`comparison-card ${bobBlocked ? 'comparison-blocked' : ''}`}><span className="comparison-route">BOB <ArrowRight size={17}/> ALICE</span><strong>{bobBlocked ? 'Attempt blocked' : 'Waiting for Bob’s attempt'}</strong><p>{bobBlocked ? 'Bob tried to view Alice’s order. Access was blocked.' : 'Ask Bob’s assistant for an Alice order to see this result.'}</p>{bobBlocked && <><small>{bobBlocked.resource_id} · {time(bobBlocked.timestamp)}</small><button className="text-button" onClick={() => jump({...emptyFilters, hours: 0, search: bobBlocked.request_id})}>View audit event</button></>}</div>
            <div className={`comparison-card ${aliceAllowed ? 'comparison-allowed' : ''}`}><span className="comparison-route">ALICE <ArrowRight size={17}/> BOB</span><strong>{aliceAllowed ? 'Data breach' : 'Waiting for Alice'}</strong><p>{aliceAllowed ? 'Alice’s assistant returned Bob’s order.' : 'Waiting for Alice’s attempt after Bob.'}</p>{aliceAllowed && <><small>{aliceAllowed.resource_id} · {time(aliceAllowed.timestamp)}</small><button className="text-button" onClick={() => jump({...emptyFilters, hours: 0, search: aliceAllowed.request_id})}>View audit event</button></>}</div>
          </div>
          <p className="comparison-note">Green: authorized access · Yellow: blocked · Red: data breach. See the recorded events in Audit explorer.</p>
        </section>}
        {view === 'Overview' && <section className="analytics-details" aria-labelledby="audit-metrics-title"><h2 id="audit-metrics-title">Activity summary</h2>
          <section className="metric-grid" aria-label="Key metrics">
            <MetricCard title="Recorded events" count={stats.total} total={stats.total} tone="neutral" icon={Activity} description={`${stats.uniqueActors} accounts in view`}/>
            <MetricCard title="Access denied" count={stats.denied} total={stats.total} tone="warning" icon={Shield} description="Events where access was denied."/>
            <MetricCard title="Completion rate" count={successfulEvents} total={stats.total} tone="success" icon={Check} description="Events completed without a data breach."/>
            <MetricCard title="Errors" count={stats.failed} total={stats.total} tone="error" icon={AlertTriangle} description="Events that could not finish."/>
          </section>
          <section className="order-outcome-grid" aria-label="Order access outcomes">
            {(['own-order-read', 'blocked-order-read', 'exposed-order-access'] as const).map(signal => <article className={`order-outcome ${signal}`} key={signal}><h3>{signal === 'own-order-read' ? 'Authorized access' : signal === 'blocked-order-read' ? 'Blocked access' : 'Data breach'}</h3><strong>{rows.filter(event => orderSignal(event) === signal).length}</strong><p>{signal === 'own-order-read' ? 'A customer’s own order was returned.' : signal === 'blocked-order-read' ? 'Access to another customer’s order was stopped.' : 'Another customer’s order was returned.'}</p></article>)}
          </section>
          <div className="chart-grid">
            <section className="panel traffic"><div className="panel-heading"><div><h2>Execution activity</h2><p>Recorded actions over time</p></div><span className="pill">{windowLabel(filters.hours)}</span></div><div className="legend"><span><i className="success-color" />Succeeded</span><span><i className="blocked-color" />Blocked</span><span><i className="exposed-color" />Data breach</span><span><i className="failed-color" />Error</span></div><div className="chart" role="img" aria-label={`Execution activity: ${stats.succeeded - exposedChartCount} succeeded, ${stats.blocked} blocked, ${exposedChartCount} data breach events and ${stats.failed} errors.`}><div className="chart-scale"><span>{maxBucket}</span><span>{Math.round(maxBucket / 2)}</span><span>0</span></div><div className="bars">{chart.map((bucket, index) => <div className="bar-slot" key={index}><div className="bar-stack" title={`${time(bucket.start)}: ${bucket.succeeded} succeeded, ${bucket.blocked} blocked, ${bucket.exposed} data breach, ${bucket.failed} errors`} style={{ height: `${bucket.total / maxBucket * 100}%` }}>{(['succeeded', 'blocked', 'exposed', 'failed'] as const).map(outcome => <span key={outcome} className={`${outcome}-bar`} style={{ height: `${bucket.total ? bucket[outcome] / bucket.total * 100 : 0}%` }} />)}</div><span className="bar-label">{index % 3 === 0 ? new Date(bucket.start).toLocaleString([], filters.hours === 1 ? { hour: 'numeric', minute: '2-digit' } : filters.hours === 24 ? { hour: 'numeric' } : { month: 'short', day: 'numeric' }) : ''}</span></div>)}</div></div></section>
            <div className="insight-stack"><section className="panel"><div className="panel-heading"><div><h2>Why access was blocked</h2><p>Recorded reasons</p></div><Shield size={18} /></div><div className="reason-list">{stats.reasons.length ? stats.reasons.slice(0, 5).map(([reason, count]) => <button key={reason} onClick={() => jump({ search: reason, decision: 'deny' })}><span>{reasonText(reason)}<strong>{count}</strong></span><span className="reason-track"><i style={{ width: `${count / stats.denied * 100}%` }} /></span></button>) : <p className="empty-small">No blocked access in this selection.</p>}</div><p className="panel-footnote">Blocked requests are not automatically attacks.</p></section>
              <section className="panel breach-panel"><div className="panel-heading"><div><h2>Data breaches by account</h2><p>Whose order was returned</p></div><ShieldAlert size={18}/></div><div className="reason-list">{breachAccounts.length ? breachAccounts.map(({account, count}) => <button key={account} onClick={() => jump({...emptyFilters, hours: filters.hours, search: `ord-${account}-`, outcome: 'breach'})}><span>{account.charAt(0).toUpperCase() + account.slice(1)}<strong>{count}</strong></span><span className="reason-track"><i style={{width: `${count / breachCount * 100}%`}}/></span></button>) : <p className="empty-small">No data breaches in this selection.</p>}</div><p className="panel-footnote">Recorded order reads in this selection.</p></section>
            </div>
          </div>
        </section>}
        {view === 'Audit explorer' && <section className="panel event-panel"><div className="panel-heading"><div><h2>Event timeline</h2><p>Green: authorized access · Yellow: blocked · Red: data breach · Purple: error. Times are local.</p></div></div><div className="table-scroll"><table className="events"><thead><tr><th>Time</th><th>Actor / action</th><th>Resource</th><th>Outcome</th><th><span className="visually-hidden">Details</span></th></tr></thead><tbody>{visibleRows.map(event => <tr key={event.event_id} className={eventRowClass(event)}><td><span className="event-time">{time(event.timestamp)}</span><small>{new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></td><td><strong>{event.actor_id ?? 'Unauthenticated'}</strong><small className="mono">{event.action}</small></td><td><span className="mono resource">{event.resource_id}</span><small>{reasonText(event.reason)}</small></td><td><EventOutcome event={event}/></td><td><button className="icon-button" aria-label={`View event ${event.event_id}`} onClick={() => setSelected(event)}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{!displayRows.length && <div className="empty"><Filter size={28} /><h3>No matching events</h3><p>Change the filters, import evidence, or connect an audit feed.</p></div>}</div>{displayRows.length > 0 && <Pagination count={displayRows.length} page={page} pageSize={pageSize} noun="events" setPage={setPage} setPageSize={setPageSize}/>}</section>}
        {view === 'Assistant requests' && <>
          <section className="metric-grid" aria-label="Assistant request metrics">
            <MetricCard title="Assistant requests" count={requests.length} total={requests.length} tone="neutral" icon={Bot} description={`${new Set(requests.flatMap(trace => trace.root.actor_id ? [trace.root.actor_id] : [])).size} accounts in view`}/>
            <MetricCard title="Completed" count={requestCounts.succeeded} total={requests.length} tone="success" icon={Check} description="Requests completed without a data breach."/>
            <MetricCard title="Errors" count={requestCounts.failed} total={requests.length} tone="error" icon={AlertTriangle} description="Requests that could not finish."/>
            <MetricCard title="Blocked" count={requestCounts.blocked} total={requests.length} tone="warning" icon={Shield} description="Requests stopped by access checks."/>
          </section>
          <section className="panel assistant-requests"><div className="panel-heading"><div><h2>Assistant request traces</h2><p>Open a request to see what the assistant did.</p></div></div>
            <p className="panel-footnote">A completed reply can still contain a blocked action. Only recorded actions appear here.</p>
            {!requests.length && <div className="empty"><Bot size={28}/><h3>No matching assistant requests</h3><p>Connect an audit feed or import assistant evidence. Try clearing the filters.</p></div>}
            {requests.slice(page * pageSize, (page + 1) * pageSize).map(trace => <details className="request-trace" key={trace.requestId}>
              <summary><span><strong>{trace.root.actor_id ?? 'Unauthenticated'}</strong><small>{time(trace.root.timestamp)} · {trace.operations.length} recorded actions</small><code>{trace.requestId}</code></span>{requestOutcome(trace) === 'breach' ? <span className="badge breach">Data breach</span> : <Badge value={trace.root.execution}/>}</summary>
              <div className="trace-actions"><button className="button" onClick={() => setSelected(trace.root)}>View request evidence</button></div>
              <ol className="trace-events">{trace.events.map(event => <li key={event.event_id}><span className="mono">{event.action}</span><span>{reasonText(event.reason)}</span><EventOutcome event={event}/></li>)}</ol>
            </details>)}
            {requests.length > 0 && <Pagination count={requests.length} page={page} pageSize={pageSize} noun="requests" setPage={setPage} setPageSize={setPageSize}/>}
          </section>
        </>}
        {view === 'Signals' && <section className="panel signals"><div className="panel-heading"><div><h2>Security checks</h2><p>Counts include all events in this demo view.</p></div><Radio size={20}/></div>{[
          {title: 'Data breach', icon: ShieldAlert, tone: 'breach', description: 'Another customer’s order was returned.', count: demoAccesses, filter: {outcome: 'breach'}},
          {title: 'Blocked access', icon: Shield, tone: 'warning', description: 'Access to another customer’s data was stopped.', count: demoEvents.filter(isOwnershipDenial).length, filter: {search: 'ownership_mismatch', decision: 'deny'}},
          {title: 'Sign-in problems', icon: LockKeyhole, tone: 'identity', description: 'A request had no valid sign-in.', count: demoEvents.filter(isAuthenticationDenial).length, filter: {signal: 'authentication', decision: 'deny'}},
          {title: 'Errors', icon: AlertTriangle, tone: 'error', description: 'An allowed action could not finish.', count: signalStats.failed, filter: {execution: 'failed', decision: 'allow'}},
        ].map(signal => <article className={`signal ${signal.tone}`} key={signal.title}><span className="signal-icon"><signal.icon size={19}/></span><div><h3>{signal.title}</h3><p>{signal.description}</p></div><strong>{signal.count}</strong>{signal.count > 0 && <button className="button" onClick={() => jump({...emptyFilters, hours: 0, ...signal.filter})}>View events</button>}</article>)}</section>}
        {view === 'Data sources' && <div className="source-grid">
          <section className="panel"><div className="panel-heading"><div><h2>{cloud ? 'Original AWS feed' : 'Local audit feed'}</h2><p>{cloud ? 'Fixed to this website’s private reporting service.' : 'Local development connection.'}</p></div><LockKeyhole size={20}/></div>
            {cloud ? <><p className="body-copy">Operator sign-in connects to the original feed. Your session is private; no token is shown on screen.</p><p className="panel-footnote">/soc-api/events · Read-only · Updates every 15 seconds</p><div className="source-actions"><button className="button" onClick={onSignOut}><Unplug size={16}/>Sign out</button></div></> : <>
              <p className="body-copy">Run the local feed and enter its operator token. The token stays in memory and is never saved to Git.</p><pre>python -m backend.soc</pre>
              {!liveToken && !originalSource.current?.token ? <form onSubmit={event => { event.preventDefault(); if (tokenInput.length < 32) {setError('Enter an operator token with at least 32 characters.'); return;} if (busy) return; originalSource.current = null; setLiveToken(tokenInput); setTokenInput(''); }}><label htmlFor="operator-token">Operator token</label><input id="operator-token" type="password" value={tokenInput} onChange={event => setTokenInput(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Enter private operator token"/><div className="form-actions"><button className="button primary" type="submit" disabled={busy}>Connect feed</button></div></form> : <div className="source-actions"><p className="connected-note">{importedFile ? 'Original feed paused while viewing a file.' : error ? 'Connection failed. Disconnect to try again.' : !hasSnapshot ? 'Connecting…' : 'Local feed connected.'}</p><button className="button" onClick={() => {originalSource.current = null; request.current?.abort(); request.current = null; setLiveToken(''); setTokenInput(''); setData(current => ({...current, source: 'import', label: 'Disconnected snapshot'})); setError('');}}>Disconnect</button></div>}
              <p className="panel-footnote">The original AWS feed is available in the <a href="https://d16nqulwj27ltb.cloudfront.net/soc/index.html" target="_blank" rel="noreferrer">hosted dashboard</a> after operator sign-in.</p>
            </>}
          </section>
          <section className="panel"><div className="panel-heading"><div><h2>Open an event file</h2><p>A temporary view of saved events.</p></div><FileUp size={20}/></div><div className="import-zone"><FileUp size={32}/><h3>Import JSON or NDJSON</h3><p>Opening a file pauses the feed. It never adds events to the feed. Up to 10 MB.</p><button className="button" onClick={() => importRef.current?.click()}>Import events</button></div>{!cloud && data.source !== 'fixtures' && <div className="source-option"><div><strong>Sample events</strong><p>Practice with generated events.</p></div><button className="button" onClick={restoreFixtures}>Use sample events</button></div>}</section>
          <section className="panel full-width"><div className="panel-heading"><div><h2>Connected applications</h2><p>Open the shopping website in a new tab.</p></div></div><div className="application-links"><a className="button" href="https://d16nqulwj27ltb.cloudfront.net/" target="_blank" rel="noreferrer">Open storefront</a></div><p className="panel-footnote">Use a chat’s support reference to find its events in Audit explorer.</p></section>
          <section className="panel full-width"><div className="panel-heading"><div><h2>Data quality and coverage</h2><p>Counts cover the events currently loaded.</p></div><Check size={20}/></div><div className="quality-grid"><div><span>Valid events</span><strong>{data.events.length}</strong></div><div><span>Invalid records excluded</span><strong>{data.rejected}</strong></div><div><span>Duplicate IDs excluded</span><strong>{data.duplicates}</strong></div><div><span>Newest event</span><strong className="quality-time">{latest === null ? 'No events' : new Date(latest).toLocaleString()}</strong></div></div><p className="panel-footnote">Invalid and repeated events are excluded. This feed may not include the full history.</p></section>
          <section className="panel full-width presentation-setup"><div className="panel-heading"><div><h2>Presentation setup</h2><p>Begin a fresh demo without changing the audit history.</p></div><LayoutDashboard size={20}/></div><p className="body-copy">{data.source === 'live' && liveToken ? 'Clear demo view starts the presentation from now. Earlier events stay available through Show full history.' : importedFile ? 'Return to the live feed above to begin a fresh demo.' : 'Connect a live feed to begin a fresh demo.'}</p>{data.source === 'live' && liveToken && <div className="source-actions presentation-actions"><button className="button primary" onClick={startPresentation}>Clear demo view</button></div>}{!(data.source === 'live' && liveToken) && <p className="panel-footnote">Sample and imported events remain separate from the live presentation.</p>}</section>
        </div>}
        <footer><span><ShieldCheck size={14} />AgentGuard SOC <span className="footer-divider">/</span> {data.source === 'fixtures' ? 'Synthetic fixtures' : 'Audit evidence'} <span className="footer-divider">/</span> Read-only</span><span>Schema v1 · {demoEvents.length} shown / {data.events.length} loaded</span></footer>
      </main>
    </div>
    <dialog ref={dialogRef} aria-labelledby="event-title" onCancel={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      {selected && <><div className="detail-heading"><div><p className="eyebrow">AUDIT EVIDENCE</p><h2 id="event-title">Event details</h2></div><button className="icon-button" aria-label="Close event details" onClick={() => setSelected(null)}><X size={20} /></button></div><div className={`detail-summary ${eventRowClass(selected) ?? ''}`}><Badge value={selected.decision} /><ArrowRight size={16} /><Badge value={selected.execution} />{orderSignal(selected) && <strong>{orderSignalLabel[orderSignal(selected)!]}</strong>}</div><dl>{Object.entries(selected).map(([key, value]) => <div key={key}><dt>{key === 'action' ? 'Action' : label(key)}</dt><dd>{value === null ? 'Unauthenticated' : String(value)}</dd></div>)}</dl>{relatedEvents.length > 1 && <section className="request-evidence"><h3>Events in this request</h3><ul>{relatedEvents.map(event => <li key={event.event_id}><span className="mono">{event.action}</span><EventOutcome event={event}/>{event.event_id !== selected.event_id && <button className="text-button" onClick={() => setSelected(event)}>View event</button>}</li>)}</ul></section>}
      <div className="detail-actions"><button className="button" onClick={async () => { try { await navigator.clipboard.writeText(investigationLink(location.href, selected.request_id)); setCopyStatus('Request link copied. Operator sign-in is required for live events.'); } catch {setCopyStatus('Clipboard unavailable. Request: ' + selected.request_id);} }}>Copy request link</button><button className="button" onClick={() => download(`event-${selected.event_id}.json`, JSON.stringify(selected, null, 2), 'application/json')}>Export event JSON</button></div>{copyStatus && <p className="copy-status" role="status">{copyStatus}</p>}</>}
    </dialog>
  </div>;
}
function CloudGate() {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/soc-api/health', {credentials: 'include', cache: 'no-store'})
      .then(response => { if (active) setSignedIn(response.ok); })
      .catch(() => { if (active) setError('Operator service unavailable.'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/soc-api/session', {method: 'POST', credentials: 'include', cache: 'no-store',
        headers: {'content-type': 'application/json'}, body: JSON.stringify({password})});
      setPassword('');
      if (!response.ok) throw new Error('Operator sign-in failed.');
      setSignedIn(true);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function signOut() {
    try { await fetch('/soc-api/session', {method: 'DELETE', credentials: 'include', cache: 'no-store'}); }
    finally { setSignedIn(false); setPassword(''); }
  }
  if (checking) return <main className="soc-login" role="status">Checking operator session…</main>;
  if (signedIn) return <App onUnauthorized={() => setSignedIn(false)} onSignOut={() => void signOut()}/>;
  return <main className="soc-login"><section className="soc-login-card"><LockKeyhole size={28}/><p className="eyebrow">AGENTGUARD / SOC</p><h1>Operator sign in</h1><p>Read-only audit evidence for the Archery Pro classroom demo.</p><form onSubmit={signIn}><label htmlFor="soc-password">Operator password</label><input id="soc-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={14}/><button className="button primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Open dashboard'}</button></form>{error && <p role="alert" className="notice error">{error}</p>}</section></main>;
}

createRoot(document.getElementById('root')!).render(cloud ? <CloudGate/> : <App/>);
