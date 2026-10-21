# DemoMart local contracts

All data is synthetic. Amounts are integer USD cents. All routes begin `/api`.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | /products?q=&category= | Public catalog search |
| GET | /products/{id} | Product and synthetic reviews |
| POST | /session | `{account: "alice" or "bob", password: string}`; rotates HttpOnly session cookie |
| GET | /session | Validated customer or 401 |
| DELETE | /session | Revoke session and clear cookie |
| GET | /orders | Only current customer's orders |
| GET | /orders/{id} | Authorize ownership before returning details |
| GET | /cart | Current customer's persisted cart |
| PUT | /cart/{productId} | `{quantity: 0..99}`; zero removes item |

Responses are JSON. Errors use `{error: string, request_id: string}`. Authentication uses a random opaque session token, stored hashed with an expiration. Never accept a customer ID from request data as identity. Local mutations require an allowed Origin; frontend and API share an origin via Vite proxy. Production must use HTTPS and Secure cookies.

## AgentGuard handoff

`backend.security.Authorizer.authorize(principal, action, resource)` returns a Decision with `allowed` and `reason`. Resources carry trusted ownership loaded by the backend. An adapter may deny additional requests; store order ownership remains mandatory. Exceptions fail closed. Operations in `StoreService` are the shared entry points for future assistant tools, with a backend-validated Principal.

## Dashboard handoff

Machine-readable schema: [audit-event.schema.json](audit-event.schema.json).

Audit schema version 1: `event_id`, `request_id`, `timestamp`, `actor_id` (nullable), `action`, `resource_id`, `decision` (`allow`/`deny`), `reason`, `execution` (`succeeded`/`blocked`/`failed`). No passwords, cookies, addresses, or review text in audit records. Decisions and outcomes are distinct; an allowed operation can fail. SQLite audit persistence is the local sink; an `AuditSink` protocol permits replacement. No public audit-read route.

## Future demo modes

Only the protected implementation exists. A future vulnerable fixture must be enabled by administrator-controlled deployment configuration, in a separate isolated synthetic-data environment with restricted access. Never accept a mode, authorization override, or customer impersonation flag from a public request or assistant tool. Preserve decision/outcome logging in both modes. Agree on that fixture with the security owner before implementation.


## Cloud adapter contract

`backend/lambda_handler.py` adapts HTTP API v2 events and cookies to the same handler. Cloud startup requires Cognito configuration and an HTTPS origin. `backend/auth.py` validates credentials with Cognito/GetUser, maps the verified immutable subject through administrator-owned identity records, and issues the existing opaque store session. Request-supplied customer IDs remain ignored. Local demo credentials are available only through the local server/default provider, never the Lambda runtime. Cognito login failures never fall back to local authentication.

`Storage.list_owned(collection, customer_id)` is now part of the storage protocol. Cart reads use a strongly consistent per-customer partition; order lists use the eventually consistent owner index and recheck ownership in the service. Direct order reads are strongly consistent. Session TTL cleanup is asynchronous; expiry remains checked synchronously.

Cloud audit rows wrap the unmodified v1 event in `value`, with `request_id`, `event_id` and expiry as storage metadata. Dashboard adapters must extract `value` before v1 schema validation. The application role can write, but cannot read/delete, audit rows. See [deployment limitations](aws-deployment.md) for non-atomic audit writes and session revocation.
