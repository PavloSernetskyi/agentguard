# Person 3: assistant integration, telemetry and SOC dashboard

Start with the [Person 3 assistant integration handoff](../docs/person-3-handoff.md), [team roadmap](../docs/team-roadmap.md), [audit contract](../docs/contracts.md) and [v1 JSON schema](../docs/audit-event.schema.json). This directory is reserved for the SOC implementation; no dashboard exists yet.

## Next: milestone 2

- Review the Ask Archery Pro chat UI and frontend API integration already present on `person-2/assistant-agentguard`. Coordinate integration/shared-file edits with Person 1; the deployed `master` site still shows the teaser until the branch is reviewed, merged and deployed.
- Validate loading, provider errors, session expiry and sign-in requirements. The component handles loading, errors, signed-out use and account-switch history clearing; add or fix states based on review. No browser API keys or fabricated AI responses.
- Keep agent-assisted fictional checkout unavailable until the UI presents the trusted cart and total and collects an explicit confirmation. The current website checkout is customer-driven and makes no payment.
- Use the authenticated chat contract in `docs/contracts.md`; treat server authorization as authoritative.
- Prepare tool-event fixtures and a consumer/contract test. Current v1 events have separate `decision` and `execution`; preserve this distinction.
- Propose v2 with conversation/tool-call correlation before adding fields: the current v1 schema does not allow additional properties.
- Implement an `AuditSink` adapter if needed with Person 1, or use offline SQLite events locally. Do not add a public audit-read route.

## Later

Milestone 3: collect and label events from the team's scoped test lab; define detections and link them to scenario IDs and outcomes.

Milestone 4: build and deploy the operator-only SOC dashboard here. Provide timeline, actor/action/resource filters, authorization/execution filters, correlated drill-down and alerts. Show denied attempts, execution failures and confirmed successful actions distinctly. Person 1 handles hosting/access and Person 2 validates security findings.

First deliverable: review the Person 2 branch UI/API, report any integration gaps, and provide representative audit fixtures plus a consumer/contract test. Keep the existing v1 schema unchanged pending agreement on a versioned extension.
