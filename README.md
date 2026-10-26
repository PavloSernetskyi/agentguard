# Daywell Market / AgentGuard

A local, synthetic shopping platform for a three-person school project. Person 1 owns the store and deployment; Person 2 owns AgentGuard enforcement; Person 3 owns the SOC dashboard.

## Project status and team plan

**Milestone 1 is complete:** the store works locally; Alice can view her order, cannot retrieve Bob's order, and the backend records the decision. Nine backend tests, the frontend build and live HTTP/proxy checks passed. The project owner has also confirmed local use works.

| Milestone | Status | Deliverable |
| --- | --- | --- |
| 1. Local Daywell Market | Complete | Store, sessions, carts, owned orders and audit baseline |
| 2. AWS deployment + real assistant | In progress | Person 1's hosted store passed order-isolation acceptance; Persons 2 and 3 integrate Strands/Groq with Ask Daywell |
| 3. Controlled penetration-testing lab | Planned | Isolated fixtures, scoped security scenarios, enforcement and detection evidence |
| 4. SOC dashboard + final demonstration | Planned | Operator dashboard, correlated alerts, findings and reproducible demo |

Read the **[team roadmap and acceptance checks](docs/team-roadmap.md)** before starting a branch.

- **Person 1 (store/AWS):** follow the [AWS MCP and deployment phase](docs/aws-next-phase.md); own Terraform, hosting, backend adapters, secrets and operational setup.
- **Person 2 (agent/security):** follow the [AgentGuard handoff](agentguard/README.md); own Strands agent backend, authorized store tools, enforcement and penetration-test scenarios.
- **Person 3 (integration/SOC):** follow the [dashboard handoff](dashboard/README.md); help deliver the chat UI and telemetry in milestone 2, then own the SOC dashboard in milestone 4.

Planned assistant architecture: **Strands + Groq inference**, with **Bedrock AgentCore evaluated as an AWS runtime**. A Groq API key does not power Bedrock-hosted inference; see the [architecture clarification and official references](docs/team-roadmap.md#architecture-clarification-strands-groq-and-bedrock). Keys remain server-side. No assistant is implemented yet.

## AWS deployment preparation status

The Person 1 cloud store is deployed at **https://d16nqulwj27ltb.cloudfront.net** in Ohio (`us-east-2`): Lambda API, owner-scoped DynamoDB storage, Cognito-backed sign-in, secure cookies, private S3/CloudFront hosting and a $5/month alert budget. The account is on an active AWS Free plan. Synthetic catalog, customers and orders are seeded. Private Alice/Bob setup and hosted ownership acceptance passed in both directions; Person 1's hosted-store handoff is ready. The public brand is now **Daywell Market**; the original `demomart-*` AWS resource IDs remain stable to avoid replacing live infrastructure.

See the [deployment runbook](docs/aws-deployment.md) for the current status, exact resource inventory, setup, cost controls and hosted acceptance checklist. Verification includes 19 Python tests, a real Terraform plan and apply, and public site/API checks. Person 2 can start agent work against the documented store interface while hosted acceptance finishes.

## Start locally

Requires Python 3.12+ and Node.js 22+. The backend uses only Python's standard library.

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

These deliberately public credentials are for a loopback-only school demo. Sessions still require backend validation, expire after one hour, rotate on login, and are revoked on logout. The opaque cookie is HttpOnly and SameSite=Strict. Production authentication, rate limits, HTTPS/Secure cookies, and durable cloud storage are deployment-phase work.

## Local implementation stages and checks (milestone 1)

1. **Structure and contracts:** see [API and teammate contracts](docs/contracts.md). `store/` contains React/TypeScript, `backend/` contains APIs and reusable operations, `seed/` contains synthetic fixtures, `tests/` contains security acceptance tests. `agentguard/`, `dashboard/`, and `infra/` provide teammate handoff notes.
2. **Storefront:** start both servers; verify ten illustrated products, search, category filters, product details, and synthetic reviews. Original SVG product illustrations live in `store/src/Art.tsx`. Fonts use Google Fonts with local system fallbacks; no remote product assets are needed.
3. **Accounts, cart, orders, audit:** sign in as Alice; add a product, adjust quantities, refresh, and open My orders. Switch to Bob and confirm his cart and orders are separate. Checkout is disabled. Ask Daywell is a coming-later panel, without AI behavior.
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

`backend/api.py:handle` accepts ordinary request values and returns `(status, headers, JSON body)`. `backend/server.py` is the local HTTP adapter. A future API Gateway/Lambda adapter can normalize its event into this handler. All private operations get identity from a validated session. `StoreService` reuses product, order, and cart operations; future assistant tools must call these operations with server-derived principals, never model-provided customer IDs.

`Storage` abstracts persistence. The SQLite adapter uses parameterized SQL and per-operation connections. SQLite collection scans are intentionally small-scale; the new DynamoDB adapter uses owner-scoped queries and pagination. Cart writes replace a product quantity; concurrent tabs use last-write-wins semantics. Audits are emitted after the operation and are not atomic with storage writes: an audit sink failure returns 500, but a completed mutation may already have persisted. A transactional outbox is deployment-phase work.

No publicly accessible bypass, refunds, payment processing, checkout execution or Bedrock calls have been added. AWS infrastructure is defined in Terraform but not provisioned; AWS MCP is connected in the developer environment. Future refund tools must introduce an explicitly authorized operation with an audit contract. [Next AWS phase](docs/aws-next-phase.md) covers Person 1's next steps; the [team roadmap](docs/team-roadmap.md) coordinates assistant integration, testing and SOC work. These are plans, not implemented cloud or AI features.
