# Person 3: assistant integration, telemetry and SOC dashboard

Start with the [team roadmap](../docs/team-roadmap.md), [audit contract](../docs/contracts.md) and [v1 JSON schema](../docs/audit-event.schema.json). This directory is reserved for the SOC implementation; no dashboard exists yet.

## Next: milestone 2

- Pair with Person 2 on the real Ask Archery Pro integration. Replace the existing coming-later teaser in `store/src/main.tsx` with chat UI states and frontend API integration, coordinating shared edits with Person 1.
- Support loading, retry, provider errors and sign-in requirements. Clear history on logout/account switch; no browser API keys or fabricated AI responses.
- Keep agent-assisted fictional checkout unavailable until the UI presents the trusted cart and total and collects an explicit confirmation. The current website checkout is customer-driven and makes no payment.
- Agree the authenticated chat contract before implementation. Treat server authorization as authoritative.
- Prepare tool-event fixtures and a consumer/contract test. Current v1 events have separate `decision` and `execution`; preserve this distinction.
- Propose v2 with conversation/tool-call correlation before adding fields: the current v1 schema does not allow additional properties.
- Implement an `AuditSink` adapter if needed with Person 1, or use offline SQLite events locally. Do not add a public audit-read route.

## Later

Milestone 3: collect and label events from the team's scoped test lab; define detections and link them to scenario IDs and outcomes.

Milestone 4: build and deploy the operator-only SOC dashboard here. Provide timeline, actor/action/resource filters, authorization/execution filters, correlated drill-down and alerts. Show denied attempts, execution failures and confirmed successful actions distinctly. Person 1 handles hosting/access and Person 2 validates security findings.

First deliverable: chat UI contract/state proposal plus representative audit fixtures, then integrate the live assistant when Person 2's endpoint is ready.
