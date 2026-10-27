# Person 2: assistant backend and AgentGuard enforcement

Start with the [team roadmap](../docs/team-roadmap.md) and [API/security contracts](../docs/contracts.md). Milestone 1 is complete; this folder currently contains handoff documentation, not a completed security engine.

## Next: milestone 2

- Lead a real Strands assistant using Groq inference. Put its service/tool adapters in proposed `backend/assistant/`; keep enforcement code here.
- Define the authenticated chat API with Person 3 and runtime requirements with Person 1 before implementation.
- Reuse `StoreService` operations for the 18-product archery catalog, beginner bow/draw-weight questions, owned order access and review summaries. Only backend-validated sessions supply identity; product and review text is untrusted.
- Implement `Authorizer` in `backend/security.py`; inject the adapter into `StoreService`. The store's ownership invariant stays enforced and policy exceptions fail closed.
- Add cross-account, conversation-isolation, malicious review, invalid argument and provider-failure tests. Coordinate versioned tool audit events with Person 3.
- The website already supports customer-driven fictional checkout. If the agent later places a fictional order, show the trusted cart and total and require an explicit UI confirmation before calling `checkout.simulate`; model text cannot supply that confirmation. Define synthetic refund requests separately with ownership, confirmation and idempotency. Never execute payments.

Groq is the model provider; Bedrock AgentCore is a possible AWS runtime. A Groq API key is not a Bedrock inference credential. Keep keys server-side and out of git.

## Later

Milestone 3: lead the threat model, scoped penetration-testing cases and protected/vulnerable lab comparison design. No publicly selectable bypass and no weakening of normal store ownership checks.

Milestone 4: tune policy/detections with Person 3, retest findings and contribute evidence to the final SOC demonstration.

First deliverable: a small PR proposing chat/tool contracts, dependencies, configuration names and tests. Person 3 can build the UI against the agreed contract; Person 1's Archery Pro store is already deployed at **https://d16nqulwj27ltb.cloudfront.net**.
