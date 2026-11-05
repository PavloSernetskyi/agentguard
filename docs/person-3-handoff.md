# Person 3 handoff: assistant integration and telemetry

## Current state

The assistant backend and Ask Archery Pro chat UI are merged to `master` from [`person-2/assistant-agentguard`](https://github.com/PavloSernetskyi/agentguard/tree/person-2/assistant-agentguard). They are **not yet deployed to AWS**; the live site still serves an older build. Person 2's local verification passed 44 Python tests and the storefront TypeScript/production build. Automated visual/browser acceptance and hosted Alice/Bob verification remain outstanding.

The component is in `store/src/AssistantChat.tsx`. It already handles signed-out prompts, loading, request errors, session-expiry sign-in, product recommendation cards, navigation, cart refresh, and clearing local history when the customer changes. Please review these behaviors and address concrete gaps rather than rebuilding the chat panel.

## API contract

Use `POST /api/assistant/messages` as documented in [contracts.md](contracts.md):

- Requires the current validated session cookie and an allowed same-origin `Origin`.
- Request body: `{ "message": string, "conversation_id"?: uuid }`. The customer identity is never supplied by the browser.
- Response includes `{ "conversation_id": uuid, "reply": string, "ui_actions": [...] }`.
- UI action types are constrained to `navigate`, `cart_updated`, and `show_products`; the frontend validates navigation paths and refreshes the signed-in customer's cart.
- Conversations are owner-scoped, bounded to 12 messages, and expire after 24 hours. Do not reuse history when the signed-in customer changes.
- Provider configuration and errors are backend-only; never expose `GROQ_API_KEY` in browser code.

## Person 3 next steps

1. Review the merged code and exercise the chat in the local app, including signed-out use, expired session, provider failure, product results, navigation, cart refresh, logout, and Alice-to-Bob account switching.
2. Run the existing test/build checks and add targeted UI/contract coverage for any gaps discovered. Include mobile layout, keyboard/focus behavior, safe text rendering, and accessible loading/error announcements in UI review.
3. Build representative assistant/tool audit fixtures and a consumer/contract test. Keep audit schema v1 unchanged: `decision` and `execution` are distinct and must remain so.
4. If SOC correlation needs conversation ID, tool-call ID, or tool name, propose a versioned extension and review it with Persons 1 and 2 before changing the schema or producer. Never add prompts, review text, credentials, cookies, addresses, or provider exceptions to audit data.
5. Coordinate API/UI changes with Person 1 and Person 2 before overlapping changes in shared files. Hosted deployment and production acceptance require Person 1's explicit review of runtime secrets, timeouts, cost, and hosted Alice/Bob isolation.

## Acceptance boundary

This handoff is for local review and integration. The code is already on `master`, but local tests alone do not authorize deployment or changes to shared AWS resources. The hosted assistant is accepted only after the deployment owner completes deployment and the integrated site passes reciprocal Alice/Bob isolation and audit checks.

## Person 3 integration completed on the SOC branch

The SOC branch incorporates master revision 4a44936, adds v1 assistant request traces and support references, and protects pending UI requests across account switches/unmounts. Backend-generated contract fixtures connect the real HTTP handler/service/audit producer to the read-only reporting feed and dashboard consumer. Storefront and dashboard tests/builds cover the integrated source. See [current integration](assistant-soc-integration.md) for reproducible commands and the distinction between a test-only runner and live Groq verification. Hosted deployment and acceptance remain pending with Person 1.
