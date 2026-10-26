# Team roadmap and ownership

Person 1 update: the Daywell Market store infrastructure and synthetic catalog are deployed in Ohio (`us-east-2`) at **https://d16nqulwj27ltb.cloudfront.net**. Hosted Alice/Bob ownership and audit verification passed, so Person 1's store handoff is ready. The real assistant and SOC integrations remain for Persons 2 and 3. See [deployment status](aws-deployment.md). Milestone 2 remains incomplete.

This is the shared handoff plan. Milestone 1 is complete; milestone 2 is in progress; milestones 3-4 are planned. Changes to ownership or contracts should be agreed in a pull request.

## Milestone overview

| Milestone | Person 1: store and AWS | Person 2: agent and security | Person 3: integration and SOC | Completion gate |
| --- | --- | --- | --- | --- |
| 1 - Local store (complete) | React store, Python API, storage, seed/reset, sessions and orders | Enforcement interface available for integration | Audit contract available for integration | Alice reads her order, cannot read Bob's, and the backend records the decision |
| 2 - AWS store and real assistant (next) | Connect AWS MCP, Terraform, deploy store/API/storage, manage runtime and secrets | Strands agent with Groq, authorized store tools, enforcement and tool tests | Ask Daywell chat UI, API integration, telemetry consumption and contract tests | Hosted store and real assistant work; both preserve Alice/Bob isolation |
| 3 - Controlled penetration-testing lab | Isolated AWS lab, reset/teardown, scope and deployment evidence | Threat model, attack scenarios, protected policies and regression tests | Event collection, detection rules and labeled test fixtures | Repeatable scoped tests produce correlated decisions and execution evidence |
| 4 - SOC dashboard and final demo | Stable demo deployment, runbook, cost/teardown checks | Tune enforcement, rerun attacks, document findings | Build SOC dashboard, alerts, filters and event drill-down | Demonstrate request -> decision -> execution -> SOC evidence end to end |

Milestone 2 has parallel deployment and assistant tracks. Persons 2 and 3 can integrate locally while Person 1 prepares AWS; milestone 2 is complete only when both tracks work together in the hosted environment. Everyone helps with testing in milestones 3 and 4.

## Milestone 1: completed baseline

- Ten synthetic products, original illustrations, search/filtering, product pages and reviews.
- Backend-validated Alice/Bob sessions, separate carts and orders, mandatory order ownership.
- Authorization interface and versioned audit events with separate decision/execution fields.
- Nine backend tests, production frontend build and live HTTP/proxy checks passed.
- The project owner has confirmed local use works. Automated visual browser checks have not been added.
- The AWS store is deployed; no working assistant, payment processing or checkout execution exists yet.

## Milestone 2: AWS deployment and Ask Daywell

### Person 1 - store and infrastructure lead

1. Follow [AWS next phase](aws-next-phase.md): confirm school account, region, budget and access; connect the chosen AWS MCP tool with read-only discovery first.
2. Add Terraform under `infra/` for static hosting/CDN, API Gateway, Python Lambda, DynamoDB and the agreed audit destination. Prefer a same-origin `/api` path for the browser.
3. Implement the Lambda transport adapter and DynamoDB storage adapter. Preserve the existing service authorization boundary and add adapter tests.
4. Add deployment-appropriate authentication/access restrictions, HTTPS cookies, rate limits, secret storage, logs and a reset/teardown runbook. Do not expose the public local demo passwords as production authentication.
5. Agree the assistant runtime with Person 2. Assess Bedrock AgentCore for Strands hosting; verify region, cost, authentication and deployment compatibility before committing. Keep runtime selection separate from model provider selection.
6. Deploy and rerun order isolation checks. Hand Persons 2 and 3 the service URL, authentication contract, environment variable names and audit sink details, never secret values.

### Person 2 - agent backend and enforcement lead

1. Implement the Python Strands assistant in a proposed `backend/assistant/` package. Keep AgentGuard policy adapters under `agentguard/`.
2. Use Groq as the initial inference provider, via a compatible Strands provider adapter. Verify the selected model's tool-calling support and pin tested dependencies; the exact model remains to be selected.
3. Wrap existing store operations for product search, the signed-in customer's orders, and synthetic review summaries. Product/review text is untrusted data, never an instruction source.
4. Derive identity from the validated backend session. The model must not choose a customer ID, supply a trusted principal, bypass authorization, or access storage directly.
5. Keep the existing protected ownership behavior; implement additional policy checks through the authorization interface. Handle policy/provider failures without leaking other customers' data.
6. Define the chat and tool-event contracts with Person 3 before UI integration. Add tests for successful tool use, cross-account attempts, malformed tool arguments, provider failure and conversation isolation.
7. Refund scope is a synthetic refund-request operation, not money movement: define ownership, eligible order states, confirmation, idempotency and an audit event before implementing it. Enable it only after its tests pass. If deferred, leave it unavailable and record the deferral in the milestone PR.

### Person 3 - assistant integration and telemetry lead

1. Turn the reserved Ask Daywell panel into a real chat interface once Person 2's API works. Coordinate edits in `store/` with Person 1.
2. Add pending, error, retry and signed-out states. Clear chat on account switch/logout; never carry Alice's history into Bob's session. Render model text safely and do not expose API keys in the browser.
3. Integrate against a documented authenticated chat endpoint. A proposed `POST /api/assistant/messages` may accept a message and an opaque conversation ID; the backend must validate conversation ownership. No such endpoint exists today.
4. Agree versioned event extensions for conversation ID, tool-call ID and tool name. Preserve the current audit schema; propose a v2 schema before adding fields because v1 rejects unknown fields.
5. Build sample event fixtures and a consumer/contract test now. Full SOC UI belongs to milestone 4, so do not block the assistant on building it.

### Milestone 2 acceptance

- Store is accessible at the agreed AWS demo URL over HTTPS; infrastructure can be reproduced and torn down.
- Alice can read her own order through both website and assistant; Bob's order cannot be disclosed through either path. Bob passes the reciprocal checks.
- Assistant actually calls the configured Groq-backed tools for search/order lookup/review summaries. Missing credentials or provider failure produces an honest error, not a fabricated result.
- Conversation/session ownership is enforced. API keys and session tokens do not appear in frontend bundles, logs or committed files.
- Tool decisions and actual execution results are correlated in durable audit events; Person 3 can consume them.
- Refund requests, if enabled, are synthetic, confirmed, authorized and idempotent. Payments and checkout execution remain out of scope.
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
| 1 | `feat/aws-foundation`: choose AWS MCP and write infrastructure plan | `store/` baseline, `backend/` transport/storage, `infra/`, `seed/` |
| 2 | `feat/assistant-tools`: propose chat/tool contracts and a Groq-backed local agent | proposed `backend/assistant/`, `agentguard/`, agent/security tests |
| 3 | `feat/assistant-chat`: propose chat UI states and sample event consumer | assistant UI in `store/`, `dashboard/`, event/UI tests |

Use small pull requests against the repository's default branch. Agree changes to `backend/api.py`, `backend/service.py`, shared UI, and `docs/contracts.md` before overlapping edits. Person 1 integrates deployment changes; Person 2 reviews authorization changes; Person 3 reviews audit changes. Include setup steps, environment variable names, verification results and any schema changes in every handoff. Commit lockfiles and placeholders; never commit credentials, Terraform state or runtime data.

## Architecture clarification: Strands, Groq and Bedrock

Planned flow: browser -> authenticated Python API -> Strands agent -> authorized store tools -> storage; Groq supplies inference and audit events feed the future SOC dashboard.

Strands is the agent framework and supports multiple model providers ([official provider documentation](https://strandsagents.com/docs/user-guide/sdk/model-providers/)). Groq supplies its own API endpoint and API key ([Groq compatibility documentation](https://console.groq.com/docs/openai)). Using a Groq key does not turn Groq inference into Bedrock-hosted inference.

Amazon Bedrock AgentCore can host agents using models inside or outside Bedrock ([AWS FAQ](https://aws.amazon.com/bedrock/agentcore/faqs/)); it is a candidate runtime for this plan, not yet provisioned. If the course specifically requires inference through Amazon Bedrock, select a Bedrock model/provider and AWS permissions instead of claiming the Groq path satisfies that requirement. Confirm this distinction with the team before deployment.

Keep `GROQ_API_KEY` server-side: ignored local configuration during development and managed secrets in AWS. Model choice and runtime configuration are deployment settings, not user-controlled request fields. AWS MCP is a developer provisioning tool; it is separate from the shopping agent's store tools and is never exposed to shoppers.
