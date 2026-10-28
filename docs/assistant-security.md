# Assistant threat model and security acceptance

## Scope and trust boundaries

This review covers the local assistant implementation on `person-2/assistant-agentguard`, using only the repository's synthetic Alice/Bob accounts and test database. It is not a penetration test of the hosted site, AWS account, Groq service, or production credentials. Do not run these cases against shared infrastructure without the owners' approval.

The browser and model provider are untrusted. The backend validates the session, derives the customer identity, authorizes operations, and exposes only narrow tools backed by `StoreService`. Product descriptions, reviews, conversation history, model output, and tool arguments are untrusted content. Persistent conversations and audit events are separate: conversation text is owner-scoped and short-lived; audit events retain the existing version 1 schema and must not contain prompts or secrets.

## Threats and controls

| Threat | Required control | Residual limitation |
| --- | --- | --- |
| Missing, forged, expired, or cross-account identity | Validate the opaque session server-side; never accept request/model-supplied customer identity; enforce ownership in the service | A hosted deployment still needs fresh end-to-end Alice/Bob verification |
| Cross-account conversation reuse | Bind each conversation to its validated owner; deny mismatches; expire history after 24 hours and keep at most 12 turns | Conversation storage is not encrypted separately from the application's storage controls |
| Prompt injection in reviews or product data | Treat catalog/review text as untrusted; never let content grant tools or identity; gate cart writes on the current customer's explicit intent | A model can still produce misleading non-transactional language; UI actions and server rules remain authoritative |
| Unintended or malformed cart writes | Expose add tool only for explicit intent with a named product; validate arguments and call the owner-scoped service; commit only after successful provider response | This is a demo cart, not inventory reservation or payment authorization |
| Malformed navigation/search input | Validate product IDs, search types/lengths and generated UI-action paths; return no action for unknown products | Input validation does not replace general service-layer authorization |
| Provider failure or exception disclosure | Fail with a generic 503, do not persist a failed turn or commit pending mutation, and do not return provider exception text | Provider availability, rate limits and spend controls require deployment-side monitoring |
| Cross-site mutation | Require an allowed origin for the assistant POST and all local mutations | Production origin, HTTPS and secure-cookie settings must be confirmed by the deployment owner |
| Sensitive-data exposure through audit | Keep schema v1; correlate by request ID; exclude prompts, reviews, addresses, cookies, keys and provider exceptions | SOC event extensions require Person 3's agreement and a versioned contract |
| Policy/storage failure | Deny on authorizer exceptions; keep ownership checks in `StoreService` | Availability failure is preferable to an unauthorized operation |

## Local security acceptance matrix

All rows are exercised with synthetic fixtures by `python -m unittest discover -s tests -v`. “Pass” means the automated test asserts both the externally visible outcome and, where applicable, the resulting storage or audit state.

| Case | Expected decision and behavior | Persistent-state/audit oracle |
| --- | --- | --- |
| No valid session or untrusted origin | Reject before invoking the provider | No assistant turn or cart write; origin rejection is 403 |
| Request supplies another customer's ID | Ignore supplied identity; tools resolve only the authenticated customer | Alice's orders/cart remain Alice-scoped; no Bob data returned |
| Another account reuses a conversation ID | Deny with 403 before calling the model | Existing history unchanged; denial audited against the requesting account |
| Conversation has expired | Start without prior history | Expired messages are not included in the next model prompt |
| Review contains instruction-like text | Keep it marked untrusted; do not make a cart tool available unless the current message independently qualifies | No cart mutation from the review content |
| Cart request lacks explicit intent or a named product | Do not expose/complete the add tool | No cart write and no cart-updated UI action |
| Cart tool receives invalid product/quantity/search arguments | Reject arguments or return no UI action | Cart remains unchanged |
| Provider fails before completion, including after a pending add | Return generic 503 without leaking provider details | Failed turn not stored; pending add not committed; audit records failure without prompt text |
| Authorizer fails | Fail closed before provider invocation | No conversation/cart write; a deny/blocked event is recorded |
| Valid customer requests product navigation or an explicit add | Return only validated navigation action or update that customer's cart | UI action is constrained; service/audit records the authorized owner-scoped operation |
| Audit correlation and minimization | Use the request ID across the request's events without changing v1 fields | Prompt, review text, cookie, address, key and provider exception are absent |

## Verification boundary

Local regression coverage does not certify hosted deployment, provider quotas, rate limiting, infrastructure IAM, dashboard ingestion, or visual accessibility. Those require coordinated acceptance by Persons 1 and 3. Keep the public site and the normal authorization policy unchanged; there is no public bypass or vulnerable mode.
