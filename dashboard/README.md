# AgentGuard SOC dashboard

## Hosted release (2026-11-05)

The dashboard sign-in page is deployed at https://d16nqulwj27ltb.cloudfront.net/soc/index.html. Its static shell is public; the `/soc-api/events` and `/soc-api/health` reporting routes require the separate Cognito `soc-operator` session. Anonymous requests returned 401 after deployment. The user reported the private operator verification succeeded, and Cognito confirms group membership. The operator password was entered privately and is not stored in Git. To reset or recheck it, run `.\.venv\Scripts\python.exe scripts\provision_soc_operator.py` from the repository root; the script prints no password or event contents.

The hosted feed uses a bounded DynamoDB `by_time` index query through a separate read-only Lambda role. The UI refreshes every 15 seconds while visible and loads at most 5,000 records. Only audit rows written after timeline keys were added appear; earlier rows remain in the table but are absent from this view. The Signals page highlights ownership denials, authentication denials, allowed operation failures, and the controlled `demo_ownership_check_disabled` condition. A tool event records a decision and execution result; visible agent output must be checked separately before claiming data exposure. No prompts or addresses are included in v1 audit events.

Person 3 owns this standalone React/TypeScript dashboard. This branch integrates the merged assistant and storefront with SOC visibility through the existing v1 audit contract. The team’s controlled classroom fixture is now represented by explicit order-access outcomes; dashboard admin write controls remain out of scope. Read the [Person 2 handoff](../docs/person-3-handoff.md) before changing assistant behavior.

## First release

- Overview with selected-event counts, authorization denial rate, execution success/failure rates, and an activity chart that separates routine success (green), blocked requests (yellow), successful cross-account order reads (red), and failed executions.
- Event timeline, actor/action/time/decision/execution filters, search, pagination and correlated request details.
- Signals derived from existing audit reasons, explicitly described as observations rather than confirmed incidents.
- JSON/NDJSON import, plain DynamoDB `value` payload import, strict v1 event validation, ID deduplication, data-quality warnings and filtered CSV/event JSON export.
- Clearly labeled Bob/Alice fixtures for UI development, including a green own-order read, yellow blocked attempt, and red cross-account read; separate from imported and local live evidence. Live evidence may also include unauthenticated requests when a session is missing or expired.
- Read-only, operator-token-protected local reporting server. No shopper account can read the feed.
- The original local build required no cloud resources or inference dependencies. The hosted release above adds an operator reporting path; no browser persistence of imported evidence is used.

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

The static build is `dashboard/dist`; frontend hosting can use `dashboard/` as its app root, `npm ci && npm run build:cloud` as the build command for the existing AWS /soc/ path, and `dist` as output. `vercel.json` supplies Vite build settings and restrictive response headers; it does not supply access control or provision a backend. A static frontend deployment alone does not deploy the reporting backend. The local shared token/SQLite server is a development bridge, not production operator identity.

The hosted release has a managed operator identity, HTTPS same-origin reporting, bounded paginated DynamoDB read access in a **separate reporting role**, and a time-ordered index. The existing store role remains audit-write-only. Its static sign-in shell is public; actual evidence remains behind operator authentication. The team has recorded hosted operator login and paired Alice/Bob traces. Polling, pagination, session resilience and final presentation acceptance remain; see the current project checklist. Teammates must use the existing Terraform state rather than applying from a fresh state.

Use [SOC metrics and release plan](../docs/soc-dashboard.md) for definitions, missing instrumentation, and the deployment gate. Keep this work in `person-3/SOC-Dashboard` and open a PR to `master` after verification. Do not deploy cloud resources from a fresh local Terraform state.

## Storefront alignment and teammate integration

The dashboard shares Archery Pro's forest green, warm ivory, copper accents, DM Sans body text and Manrope headings while preserving distinct SOC status colors and evidence views. Font assets are bundled locally through Fontsource. Design tokens live in `src/theme.css` and do not change the storefront.

Read the [assistant and SOC integration handoff](../docs/assistant-soc-integration.md) for the implemented v1 integration, local startup commands, support-reference lookup, assistant request traces and producer/consumer checks. It records the remaining cloud release gates. Backend provider integration belongs to Person 2; AWS/operator hosting belongs to Person 1; UI and audit consumption belong to Person 3.

## Integrated assistant evidence

The Assistant requests view groups merged backend events by HTTP request ID and shows audited store operations. Storefront replies and failures expose a safe support reference for operator lookup. Event details can copy an investigation link containing only that request ID. See the integration handoff for the test-only producer fixture and the six verification commands. Public catalog tools are not individually logged in v1; the UI does not claim complete tool traces or measured latency.

## Current Person 3 review

Master through `c56ed0e` is integrated. The frontend now separates Succeeded and Data breach in event filters and in correlated assistant request filters. Summary cards use count / selected total plus colored percentages; account counts mean accounts in the loaded view. Registered-account inventory is not available in v1 audit evidence.

Advanced filters provides Action and Decision in a fixed-position animated panel. The chart supports 60 minutes, 24 hours, 7 days and all history; compact denial and victim-account panels sit beside it. Error symbols use warning triangles; completion uses check marks. The evidence dialog groups copy/export buttons, places feedback below and includes loaded events from the same request without redirecting back to the explorer.

### Local preview and AWS release builds

```powershell
# Development preview at http://127.0.0.1:5174
npm.cmd run dev --prefix dashboard

# Compiled local preview at http://127.0.0.1:4174
npm.cmd run build:local --prefix dashboard
npm.cmd run preview --prefix dashboard

# Original AWS feed, managed operator sign-in and /soc/ asset paths
npm.cmd run build:cloud --prefix dashboard
```

`npm run build` and `build:cloud` always build for the original AWS feed, even if a terminal previously selected local mode. Use `build:local` for compiled local previews. Publishing still uses the team's existing AWS deployment state and process; a Git push alone does not deploy the site. No credential is included in either build. The reporting URL is fixed to the same-origin `/soc-api/events` route, not a user-editable external feed.

### Event files and presentation privacy

Opening an event file pauses the live feed and shows a temporary snapshot. It never saves events into AWS or the local audit database. Return to live feed restores the original source and polling. Cloud login uses the existing private HttpOnly operator cookie; no token is displayed. Local development tokens use a password input, stay in memory and are cleared on reload/disconnect. Source snapshots and saved connection state are not persisted to browser storage.

### Verification

19 dashboard tests cover v1 validation/correlation, mutually exclusive event outcomes, breached assistant traces, 60-minute boundaries and victim grouping. Local, default cloud and explicit cloud builds passed. UI acceptance uses disposable synthetic loopback feeds, with no AWS database changes or Groq calls; hosted acceptance remains the owner's release step.

Browser verification of this review covered event and request outcome separation; all four time badges; fixed-position animated advanced Action/Decision controls; grouped copy/export actions with feedback underneath; inline related request events; colored security icons; original cloud-feed pause/import/return and sign-out using a disposable local mock; all five views at 390px and Overview at 320px without page overflow. No hosted AWS credentials, resources or records were changed.

Timeline errors now receive a purple row background and left border, including failed cart and assistant actions. The timeline and Assistant requests share a 12 / 25 / 50 / 100 items-per-page preference; changing it returns to the first page, while feed refresh preserves the current page when possible. Empty results hide pagination; a single result page still exposes the size selector.

Motion is brief and task-related: page/section entrances, new evidence rows, changed counts, chart height transitions and dialog openings. Chart slot keys stay stable so routine polling does not replay the entrance animation. All added motion is disabled for prefers-reduced-motion. Browser verification covered timeline page counts, page-size reset, multi-page assistant request fixtures, purple error details/focus restoration and phone-width pagination. The synthetic pagination fixture remains outside Git.