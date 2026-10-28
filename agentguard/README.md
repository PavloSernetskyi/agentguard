# Person 2: assistant backend and AgentGuard enforcement

Start with the [team roadmap](../docs/team-roadmap.md) and [API/security contracts](../docs/contracts.md). Milestone 1 is complete. This branch implements the local Strands/Groq assistant slice and AgentGuard action policy; hosted deployment and end-to-end acceptance still require team integration.

## Implemented in this branch

- `backend/assistant/` configures Strands with Groq and exposes product search, product navigation, own-cart/order reads, review summarization and explicitly requested cart additions.
- `agentguard/policy.py` provides an allowlisted owner-scoped authorizer. Assistant tools call existing `StoreService` operations; the model never receives storage access or a customer ID.
- `POST /api/assistant/messages` validates the session, scopes conversations to the account, retains only 12 messages for at most 24 hours, and returns constrained UI actions.
- The storefront consumes product navigation and cart-refresh actions. It clears chat history when the account changes or signs out.
- Tests cover account isolation, navigation, explicit cart changes, untrusted reviews, invalid arguments and provider failure. Audit records remain schema v1 and do not contain conversation text.

The assistant has no checkout or refund tool. Existing customer-controlled fictional checkout remains unchanged.

## Local configuration

Install the optional, pinned provider dependencies with `python -m pip install -r requirements-assistant.txt`. Set `GROQ_API_KEY` in the backend process environment; `GROQ_MODEL` is optional and defaults to `llama-3.3-70b-versatile`. Without a key, the store works normally and the assistant endpoint responds with 503. Never place the key in frontend code, Git, or chat.

For a Python 3.12 x86_64 Lambda archive with the assistant's pinned provider packages, run `python scripts/package_backend.py --with-assistant-deps`. Configure `GROQ_API_KEY` securely in the backend runtime; do not put it in Terraform source, browser code, or a request. Person 1 must review secret storage, Lambda/API timeout and inference cost before deployment. Hosted deployment and cost acceptance are not performed by this branch.

Groq is the model provider; Bedrock AgentCore is a possible AWS runtime. A Groq API key is not a Bedrock inference credential.

## Later

Milestone 3: lead the threat model, scoped penetration-testing cases and protected/vulnerable lab comparison design. No publicly selectable bypass and no weakening of normal store ownership checks.

Milestone 4: tune policy/detections with Person 3, retest findings and contribute evidence to the final SOC demonstration.

Next: coordinate event correlation and hosted runtime requirements with Persons 1 and 3, then demonstrate the local protected assistant and repeat Alice/Bob isolation checks after integration.
