# DemoMart / AgentGuard

A local, synthetic shopping platform for a three-person school project. Person 1 owns the store and deployment; Person 2 owns AgentGuard enforcement; Person 3 owns the SOC dashboard.

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
| Alice Demo | alice | alice-demo | ord-alice-001 |
| Bob Demo | bob | bob-demo | ord-bob-001 |

These deliberately public credentials are for a loopback-only school demo. Sessions still require backend validation, expire after one hour, rotate on login, and are revoked on logout. The opaque cookie is HttpOnly and SameSite=Strict. Production authentication, rate limits, HTTPS/Secure cookies, and durable cloud storage are deployment-phase work.

## Stages and checks

1. **Structure and contracts:** see [API and teammate contracts](docs/contracts.md). `store/` contains React/TypeScript, `backend/` contains APIs and reusable operations, `seed/` contains synthetic fixtures, `tests/` contains security acceptance tests. `agentguard/`, `dashboard/`, and `infra/` provide teammate handoff notes.
2. **Storefront:** start both servers; verify ten illustrated products, search, category filters, product details, and synthetic reviews. Original SVG product illustrations live in `store/src/Art.tsx`. Fonts use Google Fonts with local system fallbacks; no remote product assets are needed.
3. **Accounts, cart, orders, audit:** sign in as Alice; add a product, adjust quantities, refresh, and open My orders. Switch to Bob and confirm his cart and orders are separate. Checkout is disabled. Ask DemoMart is a coming-later panel, without AI behavior.
4. **Verification:** run the commands below and the [manual checklist](docs/verification.md).

```powershell
python -m unittest discover -s tests -v
python -m backend.audit
cd store
npm run build
```

## First acceptance milestone

Sign in as Alice and open `http://127.0.0.1:5173/#/orders/ord-alice-001`: her synthetic order is visible. Change the URL to `http://127.0.0.1:5173/#/orders/ord-bob-001`: the API returns 403 and the UI displays Access denied without Bob's details.

Run `python -m backend.audit` from the root. Expect Alice's `orders.read` events for her order with `decision: allow`, `execution: succeeded`, and for Bob's order with `decision: deny`, `reason: ownership_mismatch`, `execution: blocked`. Request IDs correlate events with API response headers. The automated test `test_alice_own_order_allowed_bob_order_denied_and_audited` asserts this exact milestone.

## Reset

Stop the API with Ctrl+C before `python -m seed.reset`, then restart it. This deletes and recreates only `backend/data/demomart.sqlite3`, including synthetic orders, carts, sessions, and audit events. Existing browser sessions become invalid; sign in again. Data and dependency directories are ignored by source control.

## Architecture and scope

`backend/api.py:handle` accepts ordinary request values and returns `(status, headers, JSON body)`. `backend/server.py` is the local HTTP adapter. A future API Gateway/Lambda adapter can normalize its event into this handler. All private operations get identity from a validated session. `StoreService` reuses product, order, and cart operations; future assistant tools must call these operations with server-derived principals, never model-provided customer IDs.

`Storage` abstracts persistence. The SQLite adapter uses parameterized SQL and per-operation connections. Its collection scans are intentionally small-scale; a DynamoDB adapter should use owner indexes and pagination. Cart writes replace a product quantity; concurrent tabs use last-write-wins semantics. Audits are emitted after the operation and are not atomic with storage writes: an audit sink failure returns 500, but a completed mutation may already have persisted. A transactional outbox is deployment-phase work.

No publicly accessible bypass, refunds, payment processing, checkout execution, Bedrock calls, AWS infrastructure, or AWS MCP configuration has been added. Future refund tools must introduce an explicitly authorized operation with an audit contract. [Next AWS phase](docs/aws-next-phase.md) describes the handoff without configuring services.
