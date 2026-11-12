# Archery Pro Shopping / AgentGuard

**Current status:** Archery Pro Shopping and the AgentGuard SOC dashboard are hosted on AWS. The browser rehearsal confirmed Bob's blocked cross-account order read, Alice's controlled read of Bob's fictional order, and matching green/red SOC evidence. Use the **[Presentation Demo Guide](docs/presentation-demo-guide.md)** for the exact three-person prompts, clicks, handoffs and speaking lines. The [local preview guide](docs/archery-preview.md) remains available.

A deployed, synthetic shopping platform for a three-person school project. Person 1 owns the store and AWS deployment; Person 2 owns AgentGuard enforcement; Person 3 owns the assistant UI and SOC dashboard.

- **Live store:** https://d16nqulwj27ltb.cloudfront.net
- **Live SOC dashboard:** https://d16nqulwj27ltb.cloudfront.net/soc/index.html (private operator sign-in)
- **Team presentation:** [step-by-step guide for Persons 1, 2 and 3](docs/presentation-demo-guide.md)
- **AWS region:** `us-east-2` (Ohio) · **Data:** synthetic only

## Final deliverable checklist

Use this checklist for the final project demonstration. Checked items are implemented and verified; unchecked items are planned team work.

For current acceptance status and unfinished submission work, use the [project checklist](docs/project-todo.md). The [presentation guide](docs/presentation-demo-guide.md) is the live script.

### Three-person presentation areas

| Presenter | Area to explain | Show during the demo | Repository evidence |
| --- | --- | --- | --- |
| **Person 1 — store and AWS** | Storefront, account sessions, catalog, cart, fictional checkout and hosting | Bob shops, places an order, checks it, then attempts Alice's order | [Store](store/src/main.tsx), [store service](backend/service.py), [infrastructure](infra/site.tf) |
| **Person 2 — agent and guardrails** | LLM plus tool harness, server-side order ownership, and the controlled Alice order-tool weakness | Alice shops, gets a direct refusal, then receives Bob's fictional order through the JSON reframe | [Assistant](backend/assistant/__init__.py), [security tests](tests/test_assistant.py), [threat model](docs/assistant-security.md) |
| **Person 3 — interface and SOC evidence** | Assistant sidebar, request correlation, read-only audit feed and green/red security outcomes | Clear the demo view, show Bob's green blocked event, then Alice's red allowed read and its audit detail | [Assistant UI](store/src/AssistantChat.tsx), [SOC dashboard](dashboard/src/main.tsx), [audit contract](dashboard/src/audit.ts) |

These are the team roles and presentation responsibilities. Use the [step-by-step guide](docs/presentation-demo-guide.md) for each person's exact lines and screen handoffs.

### AWS services in use — Person 1 presentation area

| AWS service | How this project uses it | Evidence in this repository |
| --- | --- | --- |
| Amazon S3 | Private bucket stores the built React website | [Website infrastructure](infra/storage.tf) |
| Amazon CloudFront | Serves the store and SOC dashboard over HTTPS and forwards `/api` and `/soc-api` | [Distribution and origins](infra/site.tf) |
| Amazon API Gateway HTTP API | Routes browser requests to the store and read-only SOC Lambdas | [Store routes](infra/api.tf) and [SOC routes](infra/soc.tf) |
| AWS Lambda | Runs the Python store API and separate read-only SOC reporting API on demand | [Store handler](backend/lambda_handler.py) and [SOC handler](backend/soc_cloud.py) |
| Amazon DynamoDB | Separate store and audit tables hold synthetic data, sessions and decisions; a time index serves recent SOC evidence | [Tables](infra/storage.tf) and [storage adapter](backend/dynamo.py) |
| Amazon Cognito | Validates Alice/Bob store sessions and a separate SOC operator sign-in | [User pool](infra/auth.tf), [store authentication](backend/auth.py) and [SOC configuration](infra/soc.tf) |
| Amazon CloudWatch Logs | Records API and Lambda operational logs with seven-day retention | [Log configuration](infra/api.tf) |
| AWS Identity and Access Management (IAM) | Gives Lambda scoped access to its tables and logs | [Application role](infra/api.tf) |
| AWS Budgets | Sends monthly usage alerts at $1, $3 and $5 | [Budget configuration](infra/budget.tf) |

- [x] Deploy the storefront and backend with Terraform; keep state, plans and credentials out of Git.
- [x] Verify HTTPS storefront, 18 synthetic archery products and the live API.
- [x] Verify Alice sees her own order, receives 403 for Bob's order, and leaves allow/deny audit events; repeat as Bob.
- [x] Confirm the AWS account remains on its Free plan and the $5 budget alerts are configured. The budget sends warnings; it is not a hard spending cap.
- [ ] Before teammates change infrastructure, migrate the current local Terraform state to a shared encrypted backend with locking.

AWS MCP helped with initial provisioning and verification; it is a developer tool, **not** a shopper-facing agent tool or an AWS service the website invokes. The [deployment runbook](docs/aws-deployment.md) records the resource inventory and hosted acceptance evidence. Existing `demomart-*` resource IDs remain stable through the Archery Pro rebrand.

### Application and security

- [x] React/TypeScript storefront with original branding, responsive catalog, search, categories, product details and synthetic reviews.
- [x] Python API with a local SQLite adapter and deployed DynamoDB adapter behind the same storage interface.
- [x] Cart quantities and totals, backend-validated Alice/Bob sessions, separate synthetic orders and a local seed/reset command.
- [x] Enforce order ownership in backend operations and persist separate authorization decisions and execution outcomes.
- [x] Keep payment processing disabled; the synthetic checkout records only a fictional order. No real customers, addresses, charges or refunds.

### Agent, interface and SOC deliverables

- [x] **Person 2 area:** Strands/Groq assistant, authorized store tools, security regressions and threat-model acceptance matrix are implemented and merged to `master`.
- [x] **Person 3 area:** integrate the assistant chat/API, SOC consumer and request-ID contract coverage.
- [x] Deploy the protected assistant build with a server-side Groq secret and reviewed Lambda timeout and Terraform plan.
- [x] Verify Bob's protected Alice-order lookup is blocked and audited. Alice's controlled order-tool path returned Bob's fictional order and was audited as allowed; her ordinary order page still denies that read.
- [x] Rehearse the hosted Bob/Alice shopping and security sequence, including the two SOC handoffs and matching green/red evidence.
- [x] Deploy the SOC dashboard to AWS with managed operator access, a bounded read-only audit feed, and a reversible **Clear demo view** for the presentation.
- [x] Write the exact three-person [presentation guide](docs/presentation-demo-guide.md), including prompts, clicks, security terms and closing lines.
- [ ] Finish a separate resilience pass for slow responses, provider failures, session expiry and narrow-screen keyboard/focus behavior.
- [ ] Complete a team-run presentation and collect the submission evidence. A separate indirect prompt-injection fixture is optional.

The protected assistant and SOC dashboard are deployed and merged to `master`. Alice is the sole member of the administrator-controlled classroom group; her assistant profile is enabled through December 12, 2026, Pacific time, while Bob and the normal order APIs retain ownership checks. The live Alice exposure and paired SOC trace were verified in the hosted browser. Groq inference is separate from AWS credits. Bedrock AgentCore remains optional, and no Bedrock model inference is claimed. Follow the [project checklist](docs/project-todo.md) for the remaining gates.

## Project status and team plan

**Demo implementation is ready:** the hosted store, assistant, controlled Alice profile and SOC dashboard support the scripted three-person scene. On November 11, 2026, full local verification passed 81 Python tests, 17 store tests, 12 dashboard tests and both production builds. A team-run presentation and final submission package are still pending.

| Milestone | Status | Deliverable |
| --- | --- | --- |
| 1. Local store | Complete | Store, sessions, carts, owned orders and audit baseline |
| 2. AWS deployment + real assistant | Complete | Hosted store and Groq/Strands agent are live; Bob's protected order read is audited |
| 3. Controlled security demo | Live scene verified | Alice's classroom order-tool read returned Bob's fictional order; the ordinary order page remains protected |
| 4. SOC dashboard + final demonstration | Dashboard verified; team presentation pending | Read-only audit feed, green blocked and red exposed-order signals, and a repeatable [presentation guide](docs/presentation-demo-guide.md) |

Read the **[team roadmap and acceptance checks](docs/team-roadmap.md)** before starting a branch.

- **Person 1 (store/AWS):** follow the [AWS MCP and deployment phase](docs/aws-next-phase.md); own Terraform, hosting, backend adapters, secrets and operational setup.
- **Person 2 (agent/security):** follow the [AgentGuard handoff](agentguard/README.md); own Strands agent backend, authorized store tools, enforcement and penetration-test scenarios.
- **Person 3 (integration/SOC):** follow the [assistant integration handoff](docs/person-3-handoff.md) and [dashboard handoff](dashboard/README.md); review/integrate the chat UI and telemetry in milestone 2, then own the SOC dashboard in milestone 4.

Assistant architecture: **Strands + Groq inference**, with **Bedrock AgentCore evaluated as an AWS runtime**. A Groq API key does not power Bedrock-hosted inference; see the [architecture clarification and official references](docs/team-roadmap.md#architecture-clarification-strands-groq-and-bedrock). Keys remain server-side. The branch implementation is documented in [agentguard/README.md](agentguard/README.md).

## Hosted store status

The Person 1 cloud store is deployed at **https://d16nqulwj27ltb.cloudfront.net** in Ohio (`us-east-2`): Lambda API, owner-scoped DynamoDB storage, Cognito-backed sign-in, secure cookies, private S3/CloudFront hosting and a $5/month alert budget. The public brand is now **Archery Pro Shopping**, with 18 synthetic products. The original `demomart-*` AWS resource IDs remain stable. The current hosted assistant, order lookup, cart and fictional checkout have been exercised in the Bob/Alice rehearsal.

See the [deployment runbook](docs/aws-deployment.md) for the resource inventory, setup and cost controls. The latest complete local check passed 81 Python tests, 17 store tests, 12 dashboard tests and both production builds. The hosted browser showed Bob's denied order read and Alice's allowed cross-account order read, each with matching SOC evidence.

## Start locally

Requires Python 3.12+ and Node.js 22+. The store API uses Python's standard library; the optional assistant dependencies are in [requirements-assistant.txt](requirements-assistant.txt). For local assistant use, copy [.env.example](.env.example) to an ignored `.env.local` at the repository root and set `GROQ_API_KEY` there. The Python server reads this file on startup; keep the key out of `store/`, chat, and Git. The example selects the separate archery database and the server seeds it if empty.

From the repository root, in terminal 1:

```powershell
python -m pip install -r requirements-assistant.txt
python -m backend.server
```

In terminal 2:

```powershell
cd store
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to port 8000. Port 5173 is fixed so the mutation Origin allowlist is predictable. Use the development server for the full local app; the built static files need a same-origin API reverse proxy when deployed.

| Shopper | Account | Password | Order |
| --- | --- | --- | --- |
| Alice | alice | alice-demo | ord-alice-001 |
| Bob | bob | bob-demo | ord-bob-001 |

These deliberately public credentials are for local development only; the hosted store uses separate private Cognito passwords. Sessions require backend validation, expire after one hour, rotate on login, and are revoked on logout. The opaque cookie is HttpOnly and SameSite=Strict. The hosted store also uses HTTPS/Secure cookies, rate limits and durable cloud storage.

## Local implementation stages and checks (milestone 1)

1. **Structure and contracts:** see [API and teammate contracts](docs/contracts.md). `store/` contains React/TypeScript, `backend/` contains APIs and reusable operations, `seed/` contains synthetic fixtures, `tests/` contains security acceptance tests. `agentguard/`, `dashboard/`, and `infra/` provide teammate handoff notes.
2. **Storefront:** start both servers; verify 18 archery products, bow-style sections, search, category filters, product details with fictional draw weights, and synthetic reviews. Original generated product images live in `store/public/images/`. Fonts use Google Fonts with local system fallbacks; no remote product assets are needed.
3. **Accounts, cart, orders, audit:** sign in as Alice; add a product, adjust quantities, review the fictional checkout and record a synthetic order. Switch to Bob and confirm his cart and orders are separate. Ask Archery Pro uses the authenticated chat API when Groq is configured; without provider configuration, the rest of the store remains available. The hosted checkout also creates only synthetic orders.
4. **Verification:** run the commands below and the [manual checklist](docs/verification.md).

```powershell
python -m unittest discover -s tests -v
python -m backend.audit
cd store
npm run build
```

## Completed milestone 1: reproduce the acceptance check

Sign in as Alice and open `http://127.0.0.1:5173/#/orders/ord-alice-001`: her synthetic order is visible. Change the URL to `http://127.0.0.1:5173/#/orders/ord-bob-001`: the API returns 403 and the UI displays Access denied without Bob's details.

Run `python -m backend.audit` from the root. Expect Alice's `orders.read` events for her order with `decision: allow`, `execution: succeeded`, and for Bob's order with `decision: deny`, `reason: ownership_mismatch`, `execution: blocked`. Request IDs correlate events with API response headers. The automated test `test_alice_own_order_allowed_bob_order_denied_and_audited` asserts this exact milestone.

## Reset

Stop the API with Ctrl+C before `python -m seed.reset`, then restart it. This deletes and recreates only `backend/data/demomart.sqlite3`, including synthetic orders, carts, sessions, and audit events. Existing browser sessions become invalid; sign in again. Data and dependency directories are ignored by source control.

## Architecture and scope

`backend/api.py:handle` accepts ordinary request values and returns `(status, headers, JSON body)`. `backend/server.py` is the local HTTP adapter; `backend/lambda_handler.py` adapts API Gateway events to the same handler in AWS. All private operations get identity from a validated session. The assistant uses existing `StoreService` product, order and cart operations with server-derived principals, never model-provided customer IDs.

`Storage` abstracts persistence. The SQLite adapter uses parameterized SQL and per-operation connections. SQLite collection scans are intentionally small-scale; the new DynamoDB adapter uses owner-scoped queries and pagination. Cart writes replace a product quantity; concurrent tabs use last-write-wins semantics. Audits are emitted after the operation and are not atomic with storage writes: an audit sink failure returns 500, but a completed mutation may already have persisted. A transactional outbox is deployment-phase work.

No publicly accessible bypass, refunds, payment processing or Bedrock calls have been added. Fictional order placement is available locally and in the deployed store. The protected assistant passed reciprocal hosted Alice/Bob cross-account checks. The source defaults the intentionally weak profile to off; the approved AWS classroom deployment enables it only for Alice's assistant lookup of Bob's synthetic fixture through December 12, 2026, 11:59 pm Pacific, after which it fails closed. Both customers' normal order APIs still enforce ownership. Future refund tools must introduce an explicitly authorized operation with an audit contract. The [deployment runbook](docs/aws-deployment.md) records hosted status, and the [project checklist](docs/project-todo.md) tracks the remaining demo and SOC work.
## Person 3 SOC dashboard integration

The Person 3 dashboard in `dashboard/` consumes the merged assistant's existing v1 audit events through the protected local reporting feed. Storefront chat and audited store operations correlate by HTTP request ID. Run the dashboard at http://127.0.0.1:5174 alongside the local store and reporting service; see [dashboard setup](dashboard/README.md), [Person 2 handoff](docs/person-3-handoff.md), and [integration status](docs/assistant-soc-integration.md).

The protected assistant and SOC dashboard are hosted on the same CloudFront distribution. Open the [SOC operator sign-in page](https://d16nqulwj27ltb.cloudfront.net/soc/index.html); a separate Cognito operator account is required to read events. The static sign-in shell is public, but anonymous reporting requests return 401. The paired Bob/Alice browser traces were verified. The dashboard highlights a blocked Bob read in green and a successful Alice-to-Bob read in red; Audit explorer uses the same colors for those order-tool events. **Clear demo view** hides older records for the operator's presentation without deleting AWS audit evidence. A Git merge alone does not deploy AWS resources.
