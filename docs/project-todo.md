# AgentGuard remaining work: ordered checklist

This is the execution checklist for the final Archery Pro Shopping demonstration. The protected store and agent are hosted in AWS Ohio (`us-east-2`) at https://d16nqulwj27ltb.cloudfront.net. Both private Alice/Bob cross-account agent checks passed; broader browser regression and the lab/SOC releases remain. All accounts, orders, addresses and lab evidence must remain synthetic. The project owner will coordinate and implement the remaining work across the store, agent, lab and SOC dashboard.

**Demo roles:** Bob (project owner) attempts to read Alice's order through the protected agent. Alice (teammate) attempts to read Bob's order through an intentionally vulnerable agent in a separate, restricted lab. Person 3 presents the SOC traces. The public store enforces ownership for both customers; account identity never selects a vulnerable mode.

## 1. Freeze the protected scenario and release inputs

- [x] Define `ord-alice-001` and `ord-bob-001` as the synthetic target orders. The existing backend checks ownership using the validated session.
- [x] Add a named-order agent tool that calls `StoreService.order`, omits the address from model data, and audits cross-account denials. Local assistant and cloud-adapter tests pass.
- [ ] Agree on the exact Bob and Alice prompts and record expected HTTP/tool responses, audit decisions and visible UI behavior. A prompt typed by a shopper is a direct attack; an instruction planted in a review is an indirect prompt injection.
- [ ] Confirm the local Groq model and tests against the final prompts. Do not save prompts containing secrets or real personal information.
- [ ] Commit and review the current feature branch; keep `.env.local`, Terraform state, plans, generated packages and credentials out of Git.

## 2. Release the protected agent to the existing AWS store

- [x] Build a Python 3.12 Linux Lambda package containing Strands/OpenAI and a production React build. The current package is 30.3 MiB zipped and 68.3 MiB unzipped.
- [x] Verify the intended AWS account (`783582650755`), Ohio region, active Lambda and current $5 monthly budget. AWS cost reporting can lag.
- [x] Run and inspect the real Terraform plan using the existing private state. The saved plan added a managed Groq secret and narrowly scoped permission, updated Lambda and site objects, and replaced only obsolete hashed assets.
- [x] Provision the Groq key privately as a secret value. It is not in Terraform state, Lambda environment values, frontend code, logs, chat or Git.
- [x] Apply the reviewed protected build and verify the public CloudFront homepage, catalog and signed-out assistant rejection. The exact plan applied with 4 adds, 2 updates and 2 deletes.
- [x] Sign in privately as both Alice and Bob. Each saw their own order through the API, and each agent request for the other's named order returned HTTP 200 with no leaked address plus `orders.read / deny / blocked` under the assistant request ID.
- [ ] Complete browser regression for response time, own-order agent detail, chat failures, account switching, cart and fictional checkout after this release.
- [ ] Check current AWS spend, Groq tier/rate limits, log retention and rollback. The $5 budget is an alert, not a spending cap; do not upgrade the AWS Free plan or Groq paid tier for this project.

## 3. Build the restricted vulnerable lab

- [ ] Create a separate synthetic-data environment and an operator-controlled deployment configuration. Do not add a public bypass parameter, prompt or endpoint to the protected store.
- [ ] Implement a deliberately weak order lookup only inside that lab. Removing a system-prompt rule alone cannot bypass the current mandatory `StoreService` ownership check.
- [ ] Use distinct fictional Alice/Bob addresses and order items for a visible result. Do not store real payment information or plausible card numbers.
- [ ] Restrict access to approved demonstrators, set request limits and a teardown date, and prove that the public store remains protected.
- [ ] Rehearse Bob's protected attempt against Alice and Alice's lab attempt against Bob. Independently confirm the lab returned synthetic Bob data and the protected store returned none.
- [ ] Add an optional indirect injection fixture in an attacker-controlled synthetic product review; test it separately from direct shopper prompts.

## 4. Deploy and connect the SOC dashboard

- [x] Local dashboard renders labeled sample events, validates the v1 audit contract and groups assistant/store events by request ID.
- [ ] Add an efficient bounded recent-events query or read model for the cloud audit table. The current request-ID key cannot serve a time-ordered feed without a scan.
- [ ] Deploy a separate read-only reporting API and IAM role. The store Lambda stays audit-write-only.
- [ ] Give operators managed sign-in and protect both dashboard assets and reporting requests. Alice, Bob and anonymous visitors must receive no audit feed.
- [ ] Label each record's protected or lab source without placing prompts, addresses, cookies or keys into audit events. Show authorization decision separately from actual execution and independently verified exposure.
- [ ] Deploy the dashboard on AWS, verify HTTPS, pagination, freshness, request lookup, denied shopper access, and a live trace from each scenario.

## 5. Final demo and submission

- [ ] Record a short script: normal own-order lookup; Bob's blocked attempt against Alice; Alice's synthetic-data exposure in the restricted lab; SOC comparison by request ID; optional review injection.
- [ ] Run the full Python, store and dashboard tests and production builds; repeat hosted Alice/Bob checks after the final release.
- [ ] Document architecture, AWS services actually used, model provider (Groq), deployment revision, URLs, cost observations, known limitations and each teammate's contribution.
- [ ] Capture screenshots or exports with synthetic data only. Document lab reset and teardown, then remove resources no longer needed.

Deployment details: [AWS runbook](aws-deployment.md). API and audit contracts: [contracts](contracts.md). Dashboard limits: [SOC plan](soc-dashboard.md). Security acceptance: [assistant threat model](assistant-security.md).
