# Team roadmap and ownership

Person 1 update: **Archery Pro Shopping** is deployed in Ohio (`us-east-2`) at **https://d16nqulwj27ltb.cloudfront.net**. The deployed site has 18 synthetic archery products and a customer-driven fictional checkout. The authenticated assistant API, Strands/Groq adapter, protected store tools, storefront chat and Person 3 handoff are now merged to `master`, but the live site still serves an older build. Hosted Alice/Bob ownership and audit verification passed before assistant deployment; repeat private Alice/Bob flows after deploying the assistant. The SOC integration remains. See [deployment status](aws-deployment.md). Milestone 2 remains incomplete.

This is the shared handoff plan. Milestone 1 is complete; milestone 2 is in progress; milestones 3-4 are planned. Changes to ownership or contracts should be agreed in a pull request.

## Milestone overview

| Milestone | Person 1: store and AWS | Person 2: agent and security | Person 3: integration and SOC | Completion gate |
| --- | --- | --- | --- | --- |
| 1 - Local store (complete) | React store, Python API, storage, seed/reset, sessions and orders | Enforcement interface available for integration | Audit contract available for integration | Alice reads her order, cannot read Bob's, and the backend records the decision |
| 2 - AWS store and real assistant (in progress) | Hosted Archery Pro store; own assistant deployment, runtime secrets and cost checks | Strands agent with Groq, authorized store tools, enforcement and tool tests | Ask Archery Pro chat UI, API integration, telemetry consumption and contract tests | Hosted store and real assistant work; both preserve Alice/Bob isolation |
| 3 - Controlled penetration-testing lab | Isolated AWS lab, reset/teardown, scope and deployment evidence | Local threat model, scoped defensive scenarios and protected-policy regression tests on this branch; hosted lab execution remains pending | Event collection, detection rules and labeled test fixtures | Repeatable scoped tests produce correlated decisions and execution evidence |
| 4 - SOC dashboard and final demo | Stable demo deployment, runbook, cost/teardown checks | Tune enforcement, rerun attacks, document findings | Build SOC dashboard, alerts, filters and event drill-down | Demonstrate request -> decision -> execution -> SOC evidence end to end |

Person 1's hosted store is complete. Person 3 can review the assistant UI now on `master` and start independent telemetry work; coordinate before overlapping API/UI files or changing shared contracts. Milestone 2 is complete only when the real assistant works in the hosted environment without breaking Alice/Bob isolation. Everyone helps with testing in milestones 3 and 4.

Immediate handoff:

1. **Persons 2 and 3 together:** review the authenticated `POST /api/assistant/messages` contract and agree the versioned tool-event extension before SOC ingestion. Keep the existing v1 audit schema stable.
2. **Person 2:** local Strands + Groq vertical slice, product search/navigation, signed-in customer's cart/order tools, review summaries, targeted security regressions, and a local threat/acceptance matrix are merged to `master`. Keep refund requests unavailable. Hosted deployment and acceptance remain pending Person 1's operations.
3. **Person 3:** review the merged Ask Archery Pro chat panel and authenticated API; validate interaction states and add consumer/contract coverage rather than reimplementing the panel. Prepare audit-event fixtures and coordinate the versioned telemetry proposal with Persons 1 and 2. See [Person 3's handoff](person-3-handoff.md); full SOC UI waits for milestone 4.
4. **Person 1:** review the security/session boundary and deploy the integrated assistant only after local acceptance and a fresh cost review. Keep Groq keys server-side. Migrate Terraform state to a shared encrypted backend with locking before a teammate changes infrastructure; the current local state must not be recreated from a clean clone.

## Milestone 1: completed baseline

- Eighteen synthetic archery products, original generated images, search/filtering, product pages, draw weights and reviews.
- Backend-validated Alice/Bob sessions, separate carts and orders, mandatory order ownership.
- Authorization interface and versioned audit events with separate decision/execution fields.
- Twenty-one backend tests, production frontend build and hosted public catalog/asset checks passed.
- The project owner has confirmed local use works. Automated visual browser checks have not been added.
- The AWS store is deployed with customer-driven fictional order placement. No working assistant, real payment processing, cancellation or refund exists yet.

## Milestone 2: AWS deployment and Ask Archery Pro

### Person 1 - store and infrastructure lead

1. Completed: Terraform deployed static hosting/CDN, API Gateway, Python Lambda, DynamoDB, Cognito and the audit destination in `us-east-2`; the browser and API share an HTTPS origin.
2. Completed: the Lambda/DynamoDB adapters, private sign-in, secure cookies, throttles, logs and hosted Alice/Bob ownership/audit checks passed. The public local passwords are not accepted in the cloud.
3. Next: agree the assistant runtime with Person 2. Evaluate Bedrock AgentCore only after checking Free-plan access, region, cost and identity integration. Runtime choice is separate from model provider choice.
4. Next: integrate and deploy the assistant behind the same session boundary, manage its Groq key server-side, verify the shared audit contract and repeat hosted order-isolation checks. Do not expose passwords, tokens or keys in the handoff.

### Person 2 - agent backend and enforcement lead

1. Implemented in branch: Python Strands assistant in `backend/assistant/` using Groq's OpenAI-compatible provider. Tested dependencies and default model are documented in `agentguard/README.md`.
2. Implemented in branch: product search, constrained product navigation, own-cart/order reads, review summaries, and cart addition gated by explicit user intent plus a named product. Product/review text is untrusted; do not invent a universal hunting draw-weight threshold.
3. Implemented in branch: derive identity only from the validated backend session, use existing `StoreService` operations, and apply the allowlisted `AgentGuardAuthorizer`. The model cannot select a customer ID or access storage directly.
4. Implemented in branch: conversation ownership, short-lived bounded history, safe UI-action schema, and tests for cross-account attempts, malformed tool arguments, untrusted reviews, and provider failures.
5. Next: review the API/event contract with Person 3 and the runtime/secret/cost setup with Person 1, then repeat Alice/Bob acceptance after deployment.
6. Keep agent-assisted fictional checkout unavailable until a separate UI confirmation gate is designed. A model message or product review cannot supply confirmation. Refund scope is a separate synthetic request operation, not money movement: define ownership, eligible states, confirmation, idempotency and audit before enabling it.

### Person 3 - assistant integration and telemetry lead

1. Review the Ask Archery Pro interface merged to `master` in `store/src/AssistantChat.tsx`. Coordinate shared-file changes with Person 1; do not imply the live hosted site already has the assistant.
2. Verify loading, error, session-expiry/sign-in and signed-out states; confirm account switches clear local conversation history. The component currently includes loading, error and signed-out handling; improve gaps found during review rather than duplicating existing functionality.
3. Validate the authenticated `POST /api/assistant/messages` contract and conversation ownership against the local `master` build, then recheck after hosted deployment. The endpoint requires the validated session cookie and allowed Origin; see [API contracts](contracts.md).
4. Preserve audit v1. Agree versioned event extensions for conversation ID, tool-call ID and tool name with Persons 1 and 2; v1 rejects unknown fields. Do not put prompts, review text, cookies, addresses or provider secrets into events.
5. Build sample event fixtures and a consumer/contract test now. Full SOC UI belongs to milestone 4, so do not block assistant integration on it.

### Milestone 2 acceptance

- Store is accessible at the agreed AWS demo URL over HTTPS; infrastructure can be reproduced and torn down.
- Alice can read her own order through both website and assistant; Bob's order cannot be disclosed through either path. Bob passes the reciprocal checks.
- Assistant actually calls the configured Groq-backed tools for search/order lookup/review summaries. Missing credentials or provider failure produces an honest error, not a fabricated result.
- Conversation/session ownership is enforced. API keys and session tokens do not appear in frontend bundles, logs or committed files.
- Tool decisions and actual execution results are correlated in durable audit events; Person 3 can consume them.
- Agent-assisted order placement, if enabled, uses the existing fictional checkout only after an explicit UI confirmation of items and total. Refund requests, if enabled, are synthetic, confirmed, authorized and idempotent. Payments remain out of scope.
- Record test results, deployed components, model/runtime choice and known limitations in the milestone PR.

## Milestone 3: controlled penetration-testing preparation and execution

Only test the team's explicitly approved isolated environment and synthetic data. Write down hostnames, accounts, allowed techniques, test window, rate limits, stop conditions and cleanup steps before testing. Do not target AWS/Groq infrastructure or other tenants.

- **Person 1:** provision a separate lab and fixtures; separate roles/data from the normal demo; provide repeatable reset and teardown; record deployment version and environment.
- **Person 2:** own the threat model and tests for direct API ownership attacks, forged/expired sessions, prompt injection in synthetic reviews, tool-argument tampering, conversation crossover and unauthorized refund requests. Assert storage effects as well as HTTP responses/model text.
- **Person 3:** collect correlated events, label expected allow/deny/failed outcomes, draft detection rules and prepare SOC fixtures. Distinguish a denied request from a successful attack and from an allowed operation that failed.

The normal application remains protected. If the course needs vulnerable/protected comparisons, Person 2 designs an explicitly vulnerable fixture in a separate administrator-controlled lab deployment; Person 1 controls provisioning and access. No public mode switch, request flag, model prompt or client-provided identity may activate it. Do not weaken the shared production service or its ownership invariant to support the fixture.

Completion: a checked-in test matrix links each scenario to setup, expected behavior, actual behavior, audit evidence, cleanup and any remediation. Repeat the same scenarios after fixes. No exploit scripts or vulnerable mode are implemented by this planning update.

## Milestone 4: SOC dashboard and final demonstration

- **Person 3 leads:** authenticated, operator-only SOC UI in `dashboard/`; event ingestion, timeline, filters by actor/action/resource/decision/execution/request ID, alerts and event detail views. Use real collected events and clearly label fixtures. Keep customer data and secrets out of event payloads.
- **Person 2:** map detections to test scenarios, investigate false positives, tune policies and demonstrate blocked attempts and any isolated vulnerable-fixture results accurately.
- **Person 1:** deploy dashboard and ingestion with restricted access; maintain retention/cost controls, demo reset, deployment and teardown instructions.

Completion: demonstrate a normal order lookup, a blocked cross-account attempt, a prompt-injection attempt and an allowed operation failure. Trace each from request/tool call through authorization, actual execution and dashboard evidence. Deliver the final architecture, test report, known limitations, individual contributions and repeatable demo script.

## Collaboration and first tasks

| Person | First branch/task | Main paths |
| --- | --- | --- |
| 1 | Maintain the deployed store and review assistant integration | `store/`, `backend/` transport/storage, `infra/`, `seed/` |
| 2 | `person-2/assistant-agentguard`: implement chat/tool contracts and a Groq-backed local agent | `backend/assistant/`, `agentguard/`, agent/security tests |
| 3 | Review/integrate assistant UI states and prepare sample event consumer | assistant UI in `store/`, `dashboard/`, event/UI tests |

Use small pull requests against the repository's default branch. Agree changes to `backend/api.py`, `backend/service.py`, shared UI, and `docs/contracts.md` before overlapping edits. Person 1 integrates deployment changes; Person 2 reviews authorization changes; Person 3 reviews audit changes. Include setup steps, environment variable names, verification results and any schema changes in every handoff. Commit lockfiles and placeholders; never commit credentials, Terraform state or runtime data.

## Architecture clarification: Strands, Groq and Bedrock

Planned flow: browser -> authenticated Python API -> Strands agent -> authorized store tools -> storage; Groq supplies inference and audit events feed the future SOC dashboard.

Strands is the agent framework and supports multiple model providers ([official provider documentation](https://strandsagents.com/docs/user-guide/sdk/model-providers/)). Groq supplies its own API endpoint and API key ([Groq compatibility documentation](https://console.groq.com/docs/openai)). Using a Groq key does not turn Groq inference into Bedrock-hosted inference.

Amazon Bedrock AgentCore can host agents using models inside or outside Bedrock ([AWS FAQ](https://aws.amazon.com/bedrock/agentcore/faqs/)); it is a candidate runtime for this plan, not yet provisioned. If the course specifically requires inference through Amazon Bedrock, select a Bedrock model/provider and AWS permissions instead of claiming the Groq path satisfies that requirement. Confirm this distinction with the team before deployment.

Keep `GROQ_API_KEY` server-side: ignored local configuration during development and managed secrets in AWS. Model choice and runtime configuration are deployment settings, not user-controlled request fields. AWS MCP is a developer provisioning tool; it is separate from the shopping agent's store tools and is never exposed to shoppers.

Groq is billed separately from AWS credits. Start on Groq's Free tier and expect a 429 when its rate limit is reached ([Groq rate-limit docs](https://console.groq.com/docs/rate-limits), [billing FAQ](https://console.groq.com/docs/billing-faqs)). The project owner's no-personal-spend rule means no Groq paid-tier upgrade and no AWS Free-plan upgrade without a new explicit decision. AgentCore is a later deployment evaluation, not a prerequisite for the local assistant slice.
