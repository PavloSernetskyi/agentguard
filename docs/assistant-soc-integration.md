# Assistant and SOC integration handoff

This is Person 3's integration proposal for review with Persons 1 and 2. It does not claim that a chat endpoint, v2 event schema, managed operator login or cloud reporting service has been implemented. The current dashboard reads v1 events from fixtures, imports and a protected local reporting feed. Preserve the existing store session and authorization boundaries.

## Reviewed baseline

The reviewed remote `master` revision is `96a8049177a631b4e8824b3f71dc4ec07135df15`. At review time no later Person 2 assistant implementation had merged. The roadmap names Strands with **Groq** inference, and the user confirmed Groq. Grok/xAI is a different provider and is not the selected integration. The exact Groq model remains Person 2's tested deployment choice; do not select one in the dashboard.

## Responsibilities and handoffs

| Owner | Owns | Supplies for integration | Person 3's boundary |
| --- | --- | --- | --- |
| Person 1 | Store, AWS hosting, sessions, Cognito mapping, DynamoDB, transport/storage adapters, Terraform and release operations | Authenticated endpoint URLs, operator access, reporting infrastructure, environment/config names, deployment revision and runbook | Coordinate edits in `store/` and shared API files; do not change AWS resources or recreate Terraform state from a clean clone |
| Person 2 | Strands/Groq backend, authorized store tools, AgentGuard adapters, conversation isolation, provider error handling, security scenarios | Reviewed chat contract, actual server/tool events, policy reasons, event version, correlation IDs and producer tests | Consume events and replies; do not implement a second agent, authorization engine, direct storage access or provider SDK in either browser UI |
| Person 3 | SOC UI, audit consumer, filters/matrix/metrics, integration fixtures and consumer checks; later storefront chat panel | Consumer requirements, proposed chat/event contracts, reporting needs, UI/error states, acceptance evidence | Reporting application work is coordinated with Person 1's operator authentication, IAM and hosting; Person 2 reviews event/security semantics |

Shared files requiring coordination are `backend/api.py`, `backend/service.py`, `store/src/main.tsx`, `docs/contracts.md`, and the audit schema. The dashboard remains a separate package. A chat popover belongs in the shopper storefront; it is not a privileged SOC assistant.

## Keep the two browser paths separate

Shopper path: storefront chat → authenticated store API → Person 2's Strands agent → Groq inference and authorized `StoreService` tools → application results and durable audit events.

Operator path: authenticated SOC dashboard → operator-only reporting API → audit read model. The dashboard must not call Groq, read customer tables, execute store tools, or infer execution from chatbot text. The existing application role remains audit-write-only; use a separate reporting role for reading evidence. AWS MCP remains development tooling and is not exposed to shoppers.

Provider-specific endpoints, API keys, model configuration and retries belong on the backend. No provider secret belongs in a `VITE_` variable, browser request, localStorage or committed file. Person 1 supplies managed deployment secrets and cost limits. Person 2 verifies model tool support, bounds tool arguments, and handles provider limits/failure without bypassing authorization.

## Proposed first chat contract

Persons 2 and 3 should agree this small JSON exchange before either side depends on it. `POST /api/assistant/messages` is a proposal, not an existing route. Defer streaming until a non-streamed vertical slice works.

```json
{
  "message": "User-authored message",
  "conversation_id": null,
  "client_message_id": "opaque-unique-message-id"
}
```

The backend derives identity from a validated shopper session and creates or validates conversation ownership. It never accepts a trusted customer ID or principal from this body. Set explicit message-length, request-size, conversation-expiry and history limits. A client message ID supports retries only if the backend implements duplicate handling; it does not itself provide idempotency or replay protection. Do not automatically retry mutations.

An agreed successful response should supply `request_id`, `conversation_id`, a server message ID and assistant text, plus safe tool-call/event IDs when available. Do not return credentials, full tool arguments, hidden reasoning or other customers' data. Existing error envelopes should retain `error` and `request_id`; agree stable machine-readable codes for sign-in expiry, conversation denial, rate limiting, provider failure and timeout. Return an honest error instead of fabricating an answer. Person 2 defines status/code semantics; Person 3 renders them.

The storefront popover needs signed-out, ready, sending, completed, retryable-failure and expired-session states. Clear conversation data on logout/account switch, abort outstanding requests and ignore late responses from the previous account. Render replies as text or through an explicitly safe renderer. Any later fictional checkout must show the trusted cart and total and collect explicit UI confirmation; a model message cannot supply consent. Refunds/approval writes remain a separate future feature.

## Audit contract before dashboard integration

Keep `docs/audit-event.schema.json` v1 unchanged. Its strict fields describe event/request IDs, timestamp, authenticated actor, action/resource, authorization decision/reason and actual execution outcome. Unknown fields are rejected by the dashboard. Do not append conversation or duration fields to v1 and assume they will be accepted.

Propose a separately versioned event schema with Persons 1 and 2. Decide whether it is a new flat event or an envelope carrying a v1-compatible audit payload and a context object. The dashboard's current parser does not implement v2. Preserve original raw versioned events when a consumer normalization layer is introduced.

| Evidence to agree | Producer / owner | What the dashboard gains |
| --- | --- | --- |
| `conversation_id`, `tool_call_id`, stable tool name | Person 2, propagated by server code | Drill-down from request through individual tool calls |
| Request/event IDs propagated across model/tool boundaries | Person 2; Person 1's transport | Correlation across operational logs and audit records |
| Policy decision/reason and independent execution status | Person 2 with existing service boundary | Honest decision × execution matrix |
| Environment, deployed service revision, policy version | Persons 1 and 2 | Distinguish releases and restricted lab evidence |
| Measured provider, policy, tool and server-request durations | Person 2, with explicit start/end boundaries | Separate p50/p95 latency measures; no invented zeros for missing durations |
| Occurrence time and collector receipt time | Event producer and reporting collector | Ingestion lag, separately from request duration |
| Scenario/run IDs, expected outcome and verified storage effects | Person 2, later scoped test runner | Attack/legitimate-task success and detection evaluation |
| Session correlation reference | Person 1 with Person 2 | Session-level investigation without logging the session cookie/token |

A Groq failure is not an authorization denial. Define an assistant/provider operational event type if needed instead of reusing `authorization_error` or pretending a tool was blocked by policy. Tool retry attempts need their own identity and a shared parent request/call reference so counts are not inflated accidentally. Later approval-required states need a real schema/workflow; v1 has only allow/deny.

For a contract PR, Person 2 should provide representative allowed, denied and allowed-but-failed events generated through the actual backend. Person 3 will add them as consumer contract fixtures, validate the agreed schema, deduplicate by event ID and assert filter/correlation/metric behavior. Those ordinary regression checks can precede the later probing phase; do not claim attack effectiveness from them.

## Reporting and hosted release work

Person 1 and Person 3 must agree managed operator authentication, expiry/revocation, roles, HTTPS origin and route configuration before a hosted feed. Alice/Bob shopper sessions must not grant SOC access. Apply operator access control to the frontend as well as the API. The local shared-token/SQLite bridge is development-only.

Keep the reporting route distinct from shopper APIs. Define a versioned response envelope, source/environment, bounded page size, opaque cursor, time/filter semantics and snapshot coverage. The local envelope currently returns `{source: "local-sqlite", events: [...], next_cursor: null}`. Cloud reporting needs an explicit adapter/contract; changing only the dashboard URL does not make the local reader work with AWS. Consider `window_start`, `window_end`, `as_of` and a truncation/completeness indication in a proposed reporting envelope; do not silently call loaded records global totals.

The audit table is currently keyed by request/event ID. Person 1 owns an appropriate bounded time-ordered index/read model and least-privilege IAM; avoid periodic full table scans. Agree index consistency, retention and pagination while records arrive. Keep secrets, addresses and raw customer/review content out of audit payloads. Existing store writes and audit writes are not atomic; reliable collection/outbox and ingestion monitoring are needed before claiming complete coverage.

Frontend pushes and backend releases are separate. Person 1 deploys packaged backend/Terraform changes and operator infrastructure; a dashboard or storefront build does not automatically deploy the assistant. Keep static hosting response headers aligned with the existing dashboard configuration. If authentication requires different connection origins, review CSP/connect-src and cookie/CSRF behavior as part of that deployment rather than weakening them broadly.

## Merge sequence and acceptance

1. Review/merge the small chat, event and reporting contract proposal first. Keep existing v1 consumers compatible until the new version is explicitly supported.
2. Person 2 merges a tested local assistant/tool slice with real producer fixtures and configuration names. Person 1 reviews the session and deployment boundary; Person 3 reviews telemetry.
3. Save/commit Person 3's current dashboard changes before integrating new source. Fetch `origin/master` and merge it into `person-3/SOC-Dashboard`; resolve shared-file conflicts deliberately. Do not reset the branch or overwrite local work.
4. Add the agreed consumer adapter and fixtures. Run backend tests, dashboard consumer tests and the production build. Verify old v1 evidence still works and unknown versions produce visible quality errors.
5. After the endpoint works, integrate the storefront chat UI in a coordinated, separate change. Test account-switch/expiry/rate-limit/provider-error states and request correlation. Keep inference secrets on the server.
6. Person 1 deploys the approved backend and restricted reporting infrastructure, then the frontends. Verify deployed revisions and end-to-end evidence in staging before promoting the demo.

Hosted acceptance must demonstrate normal owned-order use, denial without disclosure, an allowed operation failure, conversation isolation, shopper denial from SOC, correct filters/exports and visible stale/missing-feed behavior. These are release regression checks, not a claim of completed penetration testing. Later attack/probing results and security effectiveness metrics remain Person 2-led work with labeled evidence.

## Visual alignment delivered in this branch

The dashboard uses the storefront's forest/ivory/copper family, DM Sans body text and Manrope headings. Fonts are bundled locally with the dashboard; no third-party font request is needed while viewing audit data. Status labels retain separate green, rust/red and amber treatments. SOC navigation, evidence tables and the decision/execution matrix remain purpose-built for operators rather than copying the store's merchandising layout.
