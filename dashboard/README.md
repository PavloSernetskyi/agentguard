# AgentGuard SOC dashboard

Person 3 owns this standalone React/TypeScript dashboard. This branch integrates the merged assistant and storefront with SOC visibility through the existing v1 audit contract. Attack probing, vulnerable fixtures, and admin write controls remain deferred. Read the [Person 2 handoff](../docs/person-3-handoff.md) before changing assistant behavior.

## First release

- Overview with selected-event counts, authorization denial rate, execution success/failure rates, activity chart and denial reasons.
- Decision × execution matrix with drill-down; timeline, actor/action/time/decision/execution filters, search, pagination and correlated request details.
- Signals derived from existing audit reasons, explicitly described as observations rather than confirmed incidents.
- JSON/NDJSON import, plain DynamoDB `value` payload import, strict v1 event validation, ID deduplication, data-quality warnings and filtered CSV/event JSON export.
- Clearly labeled fixtures for UI development, separate from imported and local live evidence.
- Read-only, operator-token-protected local reporting server. No shopper account can read the feed.
- No new cloud resources or inference dependencies. No browser persistence of tokens or imported evidence.

## Run the dashboard

Node 22.18+ and Python 3.12+ are supported. From the repository root:

```powershell
cd dashboard
npm ci
npm run dev
```

Open http://127.0.0.1:5174. It starts with 64 synthetic fixtures, prominently labeled as sample data. These are not recorded attacks. Imports are static snapshots; all filters and exports apply to the loaded event selection. Empty denominators display a dash instead of a misleading zero percent.

## Read real local audit events

Use the existing local store normally to produce events. If its database does not exist, run `python -m backend.server` from the repository root; it initializes local data only when empty. Do not reset an existing database to start the dashboard.

In another PowerShell terminal at the repository root, generate an operator token and start the reporting feed:

```powershell
$env:AGENTGUARD_SOC_TOKEN = python -c "import secrets; print(secrets.token_urlsafe(32))"
python -m backend.soc
```

The server binds only to `127.0.0.1:8001`. In that same terminal, use `$env:AGENTGUARD_SOC_TOKEN | Set-Clipboard` when you need to paste the value into **Data sources → Operator token**, then connect. This places a local secret on the clipboard; clear it afterward with `Set-Clipboard -Value ''`. Do not commit, share or put it in a `VITE_` variable. Reloading/disconnecting clears the dashboard's in-memory token. Stop the reporting process and unset the variable when finished: `Remove-Item Env:AGENTGUARD_SOC_TOKEN`.

Vite proxies `/soc-api` to the loopback reporting server. A separate Python server reads SQLite using `mode=ro` and `PRAGMA query_only`; no store API or authorization changes are required. The feed refuses missing databases and never seeds/resets data. Operator tokens are checked before any database access. No cross-origin access is enabled.

`GET /soc-api/events?limit=250&cursor=...` requires `Authorization: Bearer <operator-token>`. It returns `{source: "local-sqlite", events: [...], next_cursor: string|null}`. Page sizes are 1–500. Cursor paging uses timestamp and record key, avoiding offset shifts from newer events. The UI polls every 15 seconds and loads at most 5,000 records; it displays a coverage warning if additional pages exist. Statistics are recomputed from loaded filtered events, not global database totals. `GET /soc-api/health` also requires the token. All reporting responses use `Cache-Control: no-store`.

## Import a snapshot

From the repository root, export real local records with:

```powershell
New-Item -ItemType Directory -Force artifacts | Out-Null
python -m backend.audit | Set-Content -Encoding utf8 artifacts/audit-snapshot.ndjson
```

Import that file in the UI. Snapshots can contain operator evidence: keep them out of source control and follow team retention rules. JSON arrays, `{events: [...]}` envelopes, NDJSON, and plain exported cloud rows containing `value` are supported. Low-level DynamoDB AttributeValue JSON (`{"M": ...}`) is not supported; convert that format first. The import cap is 10 MB / 50,000 records. Invalid records and duplicate IDs are excluded with visible counts. Completely invalid imports leave the previous dataset unchanged. Imports select all loaded history so old evidence does not disappear under a 24-hour filter.

## Verify

```powershell
python -m unittest discover -s tests -v
cd dashboard
npm test
npm run build
```

Manual acceptance: use each source; verify a blocked event differs from a failed execution; compose filters; open details and correlate by request ID; import an empty file and malformed file; export a filtered CSV; disconnect; check keyboard navigation and narrow layouts. No model calls or attack probes are needed.

## Ship with the team

The static build is `dashboard/dist`; frontend hosting can use `dashboard/` as its app root, `npm ci && npm run build` as the build command, and `dist` as output. `vercel.json` supplies Vite build settings and restrictive response headers; it does not supply access control or provision a backend. A static frontend deployment alone does not deploy the reporting backend. The local shared token/SQLite server is a development bridge, not production operator identity.

Before an operator deployment, Person 1 and Person 3 must add a managed operator identity/role boundary, HTTPS same-origin reporting, bounded paginated DynamoDB read access in a **separate reporting role**, and approved hosting/retention/cost configuration. The existing store role is audit-write-only and must stay that way. The current audit table keys by request/event, so a time-ordered feed needs an agreed index/read model; do not implement polling with unbounded table scans. Migrate shared Terraform state before teammate applies. Test that unauthenticated requests and Alice/Bob customer sessions cannot read audits. Apply authentication to the operator frontend as well as the API.

Use [SOC metrics and release plan](../docs/soc-dashboard.md) for definitions, missing instrumentation, and the deployment gate. Keep this work in `person-3/SOC-Dashboard` and open a PR to `master` after verification. Do not deploy cloud resources from a fresh local Terraform state.

## Storefront alignment and teammate integration

The dashboard shares Archery Pro's forest green, warm ivory, copper accents, DM Sans body text and Manrope headings while preserving distinct SOC status colors and evidence views. Font assets are bundled locally through Fontsource. Design tokens live in `src/theme.css` and do not change the storefront.

Read the [assistant and SOC integration handoff](../docs/assistant-soc-integration.md) for the implemented v1 integration, local startup commands, support-reference lookup, assistant request traces and producer/consumer checks. It records the remaining cloud release gates. Backend provider integration belongs to Person 2; AWS/operator hosting belongs to Person 1; UI and audit consumption belong to Person 3.

## Integrated assistant evidence

The Assistant requests view groups merged backend events by HTTP request ID and shows audited store operations. Storefront replies and failures expose a safe support reference for operator lookup. Event details can copy an investigation link containing only that request ID. See the integration handoff for the test-only producer fixture and the six verification commands. Public catalog tools are not individually logged in v1; the UI does not claim complete tool traces or measured latency.
