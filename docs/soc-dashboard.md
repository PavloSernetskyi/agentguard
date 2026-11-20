# SOC dashboard metrics and release plan

The dashboard consumes strict v1 audit evidence from the local reporting bridge or the hosted operator-only DynamoDB feed. Master through `c56ed0e` is integrated into Person 3’s branch. The hosted store, Groq assistant, operator feed and controlled Alice classroom profile are implemented by the team; the remaining work is interaction acceptance, reliability and final presentation evidence.

The normal store APIs enforce ownership. The administrator-controlled classroom profile deliberately permits synthetic Alice-to-Bob agent order reads; a recorded successful tool read is separate from verification of what the assistant displayed. Dashboard changes do not enable that profile or call the model.

## Metrics available now

All metrics use valid, deduplicated events inside the active filters and loaded time range. Counts are audit event counts; a request can have multiple events. They are not automatically user/task counts. Null denominators display a dash.

| Metric | Definition | Operational purpose |
| --- | --- | --- |
| Audit volume | Number of selected valid event IDs | Establish activity and give every rate its denominator |
| Authorization denial rate | Denied events / selected events | Observe authorization rejections; do not interpret as attack frequency |
| Completion rate | Presentation outcome `succeeded` / selected events; known breach reads are excluded | Show completion separately from data breaches |
| Errors | `failed` / selected events | Show the share of selected events that could not finish |
| Accounts in view | Distinct non-null actor IDs in the selected records | Accounts seen in evidence; not a registered-account or active-session inventory |
| Denial reasons | Denied events grouped by reason | Review ownership mismatches, invalid sessions and policy errors |
| Order-access outcomes | Separate counts of own-order successes, blocked order reads, and successful controlled-demo cross-account reads | Keep authorized execution distinct from secure access |
| Invalid/duplicate records | Excluded records and repeated event IDs on ingestion | Make data-quality limits visible |
| Newest event timestamp | Maximum event time in loaded evidence | Evidence freshness; not network, ingestion or gateway latency |

The overview no longer displays the decision/execution matrix. The timeline shows one derived Outcome; event details and exports retain the original decision and execution fields. v1 permits allow/blocked but forbids deny/succeeded and deny/failed; invalid pairs are rejected. Raw v1 execution can be succeeded for a breached order read. Presentation outcomes separate these records into Data breach, and the Succeeded filter excludes them. This is not a general incident-detection or security success rate. Order outcome counts use the same `orderSignal` classification as the timeline.

Overview displays the selected-event count, active filters, and time range. Feed refresh preserves the current pagination page and clamps it if fewer pages remain. Clearing a demo view changes only the browser’s live-event time boundary; it never deletes stored evidence. Fixture/import views cannot be cleared as though they were a live presentation.

## Observation rules in this release

Ownership mismatch, authentication rejection, and allowed-operation failure are review conditions derived directly from existing fields. No malicious-intent classification, severity score, confirmed attack count or notification is invented. The current source and fixture status stay visible. A completed audit outcome is evidence recorded by the application, not an independent verification of database effects.

## Instrumentation needed later

| Capability | Required evidence before displaying a metric |
| --- | --- |
| Gateway / end-to-end p50 and p95 | Server-measured durations with defined boundaries and sampling; propose v2 rather than adding fields to strict v1 |
| Attack success and prevention | Scenario/run IDs, expected authorization, actual returned data and independently verified storage effects, with explicit attack-attempt denominator |
| Legitimate task success | Labeled legitimate scenarios and task completion criteria, not merely `allow` events |
| False positives / detection precision and recall | Ground truth labels reviewed by security owner and versioned detection results; define confusion matrix and thresholds |
| Approval rate and approval timing | Actual approval-required state, request/decision timestamps, exact-action correlation and authenticated approver workflow |
| Mean time to acknowledge / resolve | Alert lifecycle, incident IDs, acknowledgment and resolution timestamps; raw denials cannot supply these |
| Telemetry completeness and ingestion lag | Producer/collector counts or sequence/checkpoints plus occurrence/receipt timestamps; browser refresh time cannot establish completeness |
| Cost | Measured usage and price attribution with a defined window; do not estimate from audit count |

## Remaining implementation and release gates

1. **Person 3, before release:** review this branch’s responsive layout and interaction changes in a PR, merge, and have Person 1 release the static dashboard using the existing deployment state. Record the commit actually served by CloudFront.
2. **Persons 1 and 3, hosted acceptance:** verify a new synthetic event arrives on the visible-tab 15-second poll; navigate multiple pages; clear the presentation view, produce a new event, and open its request trace. Recheck session expiry/revocation, shopper/anonymous denial, exports, keyboard focus, narrow screens and feed failure/recovery. Local synthetic QA does not replace AWS acceptance.
3. **Person 1, operations:** confirm retention, current spend and rate limits; document rollback, reset and teardown. Use the existing Terraform state; establish a shared encrypted backend with locking before another teammate applies infrastructure.
4. **Persons 1 and 2, evidence reliability:** document or remediate the non-atomic application/audit writes, monitor audit failures, and state the index consistency and coverage limits. The feed loads at most 5,000 records and excludes legacy rows without timeline keys; missing events are not proof of missing activity.
5. **Persons 2 and 3, evaluation:** keep v1 stable. Agree v2 for conversation/tool-call/scenario IDs, measured durations, safe error categories and environment/revision before showing latency, precision/recall or attack-prevention rates. Incident acknowledgment/resolution metrics require an actual incident workflow.
6. **All three, submission:** rehearse the green/yellow/red outcomes and speaking handoffs, capture synthetic evidence, and finish the architecture, test results, contributions and limitations. Optional indirect-review injection is a separate scenario from the current direct shopper reframe.

The local operator token is a development credential with process-lifetime revocation. It is not individual user attribution, RBAC, MFA, or managed cloud sessions. Read-only evidence access and production hosting are separate responsibilities from admin mode/reset/approval writes, which are excluded from this release.

## Assistant integration

Assistant requests are distinct HTTP request IDs with assistant.message root events. Assistant request outcomes use root execution plus loaded correlated tool evidence: a known breach read makes the request Data breach even when its reply succeeded. Completed excludes those requests. Expanded traces show other loaded events with the same request ID, including private store operations. These request counts are separate from event counts in the overview. Conversation ownership mismatches are included in ownership signals. See [implemented integration](assistant-soc-integration.md) for scope, setup and producer/consumer verification.

## Presentation controls and labels

The main views use a single Time / Person / Outcome filter set. Audit explorer has an animated Advanced filters panel for Action and Decision. Its timeline shows one Outcome column; opening an event preserves the original decision and execution evidence. Signals uses the whole demo view, with one live Clear demo view action. Import belongs to Data sources and live Refresh belongs to the header.

Presentation labels are Authorized access, Blocked access, Data breach (the controlled synthetic demo), and Error. The activity chart uses green, yellow, red and striped purple respectively. Error styling is distinct from blocked access. Raw v1 data and exports are unchanged.


## Current review semantics

Overview cards show count / selected events plus a colored percentage. Completion counts recorded succeeded events except known breach reads; errors and denials use the same selected-event denominator. Assistant cards use selected request count as their denominator. Counts describe the visible evidence, not the entire AWS account or an account registry. Zero denominators display a dash.

The time choices are Last 60 minutes, Last 24 hours, Last 7 days and All history, with matching chart badges. The compact right-side panels group denial reasons and breach counts by the known victim account. Audit v1 currently identifies only the controlled Alice-to-Bob order fixture; Bob is the known victim. Other owner mappings require explicit producer evidence rather than guessing from an actor ID.

Imports pause polling, retain the original source in memory and offer Return to live feed. They never upload or merge events into the reporting service. Reload returns a cloud build to operator sign-in/the original feed. Cloud credentials remain HttpOnly cookies; local tokens are masked, memory-only and absent from Git. Default production builds target the original same-origin AWS reporting path. `build:cloud` explicitly selects it; `build:local` produces a local fixture/reporting preview.
