# Archery Pro Shopping / AgentGuard

**Current store:** Archery Pro Shopping is on `master` and powers the existing AWS demo URL with original generated product photography, 18 synthetic items and a fictional checkout. The [local guide](docs/archery-preview.md) remains available.

A deployed, synthetic shopping platform for a three-person school project. Person 1 owns the store and AWS deployment; Person 2 owns AgentGuard enforcement; Person 3 owns the assistant UI and SOC dashboard.

**Live store:** https://d16nqulwj27ltb.cloudfront.net · **AWS region:** `us-east-2` (Ohio) · **Data:** synthetic only

## Final deliverable checklist

Use this checklist for the final project demonstration. Checked items are implemented and verified; unchecked items are planned team work.

### AWS services in use — Person 1 complete

| AWS service | How this project uses it | Evidence in this repository |
| --- | --- | --- |
| Amazon S3 | Private bucket stores the built React website | [Website infrastructure](infra/storage.tf) |
| Amazon CloudFront | Serves the site over HTTPS and forwards `/api` to the backend | [Distribution and origins](infra/site.tf) |
| Amazon API Gateway HTTP API | Receives browser API requests and invokes Lambda | [API routes](infra/api.tf) |
| AWS Lambda | Runs the Python store API on demand | [Lambda handler](backend/lambda_handler.py) and [infrastructure](infra/api.tf) |
| Amazon DynamoDB | Separate store and audit tables hold synthetic data, sessions and decisions | [Tables](infra/storage.tf) and [storage adapter](backend/dynamo.py) |
| Amazon Cognito | Validates the private Alice and Bob accounts before store sessions are issued | [User pool](infra/auth.tf) and [authentication adapter](backend/auth.py) |
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

### Remaining group deliverables

- [ ] **Person 2:** review and integrate the Strands/Groq assistant implementation on the Person 2 branch; run hosted security acceptance tests after deployment.
- [ ] **Person 3:** coordinate versioned tool-event telemetry and lead the SOC dashboard; the storefront chat panel is available on the Person 2 branch.
- [ ] **Team:** run controlled security tests against an isolated vulnerable fixture and the protected store; document actual tool results and audit evidence.
- [ ] **Person 3 leads:** build an operator-only SOC dashboard showing correlated requests, decisions, executions and alerts.
- [ ] **Final demo:** show normal Alice/Bob use, a blocked cross-account agent request, an indirect prompt-injection attempt, a clearly labeled isolated vulnerable comparison, and the matching SOC timeline.

The store is deployed; the assistant implementation is available on the Person 2 branch but is not yet merged or deployed. The vulnerable lab and SOC dashboard are also not deployed. Groq inference is separate from AWS credits. Bedrock AgentCore remains an optional runtime to evaluate, and no Bedrock model inference is currently claimed. See the [team roadmap](docs/team-roadmap.md) for owners and acceptance criteria.

## Project status and team plan

**Milestone 1 is complete:** the store works locally; Alice can view her order, cannot retrieve Bob's order, and the backend records the decision. The original 21 baseline tests passed before assistant work; this branch adds assistant acceptance tests.

| Milestone | Status | Deliverable |
| --- | --- | --- |
| 1. Local store | Complete | Store, sessions, carts, owned orders and audit baseline |
| 2. AWS deployment + real assistant | In progress | Archery Pro store is deployed; Persons 2 and 3 integrate Strands/Groq with Ask Archery Pro |
| 3. Controlled penetration-testing lab | Planned | Isolated fixtures, scoped security scenarios, enforcement and detection evidence |
| 4. SOC dashboard + final demonstration | Planned | Operator dashboard, correlated alerts, findings and reproducible demo |

Read the **[team roadmap and acceptance checks](docs/team-roadmap.md)** before starting a branch.

- **Person 1 (store/AWS):** follow the [AWS MCP and deployment phase](docs/aws-next-phase.md); own Terraform, hosting, backend adapters, secrets and operational setup.
- **Person 2 (agent/security):** follow the [AgentGuard handoff](agentguard/README.md); own Strands agent backend, authorized store tools, enforcement and penetration-test scenarios.
- **Person 3 (integration/SOC):** follow the [dashboard handoff](dashboard/README.md); help deliver the chat UI and telemetry in milestone 2, then own the SOC dashboard in milestone 4.

Assistant architecture: **Strands + Groq inference**, with **Bedrock AgentCore evaluated as an AWS runtime**. A Groq API key does not power Bedrock-hosted inference; see the [architecture clarification and official references](docs/team-roadmap.md#architecture-clarification-strands-groq-and-bedrock). Keys remain server-side. The branch implementation is documented in [agentguard/README.md](agentguard/README.md).

## Hosted store status

The Person 1 cloud store is deployed at **https://d16nqulwj27ltb.cloudfront.net** in Ohio (`us-east-2`): Lambda API, owner-scoped DynamoDB storage, Cognito-backed sign-in, secure cookies, private S3/CloudFront hosting and a $5/month alert budget. The public brand is now **Archery Pro Shopping**, with 18 synthetic products. The original `demomart-*` AWS resource IDs remain stable. Private Alice/Bob hosted ownership passed before this visual/catalog rollout; repeat the browser sign-in, own-order, cross-order and fictional checkout checks when integrating the assistant.

See the [deployment runbook](docs/aws-deployment.md) for the current status, resource inventory, setup, cost controls and hosted acceptance evidence. This rollout passed 21 Python tests, a frontend build, a reviewed Terraform plan/apply, public catalog and asset checks, and an unauthenticated order denial with a matching audit event. Persons 2 and 3 can now branch from `master` and use the documented store and audit contracts.

## Start locally

Requires Python 3.12+ and Node.js 22+. The store API uses Python's standard library; the optional assistant dependencies are in [requirements-assistant.txt](requirements-assistant.txt).

From the repository root, in terminal 1:

```powershell
python -m seed.reset
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
3. **Accounts, cart, orders, audit:** sign in as Alice; add a product, adjust quantities, review the fictional checkout and record a synthetic order. Switch to Bob and confirm his cart and orders are separate. On the Person 2 branch, Ask Archery Pro uses the authenticated chat API when Groq is configured; without provider configuration, the rest of the store remains available. The hosted checkout also creates only synthetic orders.
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

No publicly accessible bypass, refunds, payment processing or Bedrock calls have been added. Fictional order placement is available locally and in the deployed store. The store's AWS infrastructure is deployed from Terraform; the assistant implementation is on the Person 2 branch and is not yet hosted. Future refund tools must introduce an explicitly authorized operation with an audit contract. The [deployment runbook](docs/aws-deployment.md) covers Person 1's hosted store, and the [team roadmap](docs/team-roadmap.md) coordinates assistant integration, testing and SOC work.
