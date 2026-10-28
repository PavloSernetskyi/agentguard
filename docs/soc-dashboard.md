# SOC dashboard metrics and release plan

This increment prioritizes Person 3's SOC dashboard over chat UI work at the user's request. It consumes the existing v1 store audit evidence. AI/agent examples, prompt-injection probes and vulnerable lab work remain later milestones. No inference or cloud resources are provisioned by this change.

## Metrics available now

All metrics use valid, deduplicated events inside the active filters and loaded time range. Counts are audit event counts; a request can have multiple events. They are not automatically user/task counts. Null denominators display a dash.

| Metric | Definition | Operational purpose |
| --- | --- | --- |
| Audit volume | Number of selected valid event IDs | Establish activity and give every rate its denominator |
| Authorization denial rate | Denied events / selected events | Observe authorization rejections; do not interpret as attack frequency |
| Successful execution rate | `allow` + `succeeded` / all `allow` | Separate authorization from application reliability |
| Execution failure rate | `allow` + `failed` / all `allow` | Find failures after authorization; not equivalent to HTTP 5xx rate |
| Unique request and actor counts | Distinct request IDs and non-null actor IDs | Correlation and activity context; actors are not active-session counts |
| Denial reasons | Denied events grouped by reason | Review ownership mismatches, invalid sessions and policy errors |
| Decision × execution matrix | Count of events for each decision/outcome pair | Prevent blocked attempts being confused with successful actions or failures |
| Invalid/duplicate records | Excluded records and repeated event IDs on ingestion | Make data-quality limits visible |
| Newest event timestamp | Maximum event time in loaded evidence | Evidence freshness; not network, ingestion or gateway latency |

The matrix has allow/deny rows and succeeded/blocked/failed columns. v1 permits allow/blocked but forbids deny/succeeded and deny/failed. Invalid v1 pairs are rejected and counted as invalid input. Empty matrix cells are not proof of complete logging. Every matrix cell and rate follows the same filters as the timeline.

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

1. **This branch:** isolated dashboard package; strict audit consumer; offline/fixture/local feed; metrics and matrix; filters/drill-down/export; auth/read-only reporting tests and build. No store API changes.
2. **Team staging:** Person 1 provisions operator identity, private frontend access and reporting deployment; Persons 1 and 3 design bounded DynamoDB query access with a reporting-only role. Keep the application audit writer read-restricted. Establish retention, redaction, budget and shared Terraform backend/locking. Review the PR before provisioning.
3. **Hosted acceptance:** verify role denial for anonymous users and shoppers, operator access/revocation, session expiry, HTTPS/cache headers, pagination, stale-feed indication, export and no secret/customer-data leakage. Verify the deployed URL and record deployment revision, rollback and teardown.
4. **Reliability:** transactional audit/outbox or documented write/evidence gaps, monitored ingestion failures, deterministic query window and index consistency, durable alert lifecycle if alerts are added. Current store operations and audit writes are not atomic; missing events cannot be interpreted as missing activity.
5. **Later security evaluation:** agree v2 with Person 2 for tool/conversation/scenario correlation, durations, environment/mode and approvals. Add labeled evaluation metrics only after that evidence exists. Keep vulnerable fixtures restricted and separate.

The local operator token is a development credential with process-lifetime revocation. It is not individual user attribution, RBAC, MFA, or managed cloud sessions. Read-only evidence access and production hosting are separate responsibilities from admin mode/reset/approval writes, which are excluded from this release.
