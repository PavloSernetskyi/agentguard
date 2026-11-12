# AgentGuard remaining work: ordered checklist

**Presentation script:** follow the [three-person Presentation Demo Guide](presentation-demo-guide.md) on the live store and [SOC dashboard](https://d16nqulwj27ltb.cloudfront.net/soc/index.html). Person 3 clicks **Clear demo view** before Bob starts, shows Bob's green blocked card after his attempt, then Alice's red allowed-read card after her JSON request. No manual request-ID filter is needed. Do not put passwords in team notes. Alice's classroom profile expires after December 12, 2026, Pacific time.

This is the execution checklist for the final Archery Pro Shopping demonstration. The store, assistant, Alice-only classroom profile, and SOC dashboard are hosted in AWS Ohio (`us-east-2`) at https://d16nqulwj27ltb.cloudfront.net. The Bob/Alice security scenes and paired SOC traces were verified in the hosted browser; resilience, operator workflow and submission checks remain below. All accounts, orders, addresses and test evidence are synthetic.

**Demo roles:** Bob (project owner) attempts to read Alice's order through the protected agent. Alice (teammate) attempts to read Bob's order through an intentionally vulnerable, administrator-enabled demo profile on the same AWS website. Person 3 presents the SOC traces. The normal store APIs continue to enforce ownership for both customers. An assistant prompt or request parameter cannot enable the demo profile.

## 1. Freeze the protected scenario and release inputs

- [x] Define `ord-alice-001` and `ord-bob-001` as the synthetic target orders. The existing backend checks ownership using the validated session.
- [x] Add a named-order agent tool that calls `StoreService.order`, omits the address from model data, and audits cross-account denials. Local assistant and cloud-adapter tests pass.
- [x] Write exact Bob and Alice prompts, tool outcomes and presentation lines in the [Presentation Demo Guide](presentation-demo-guide.md). The hosted browser rehearsal confirmed the direct Alice refusal and JSON reframe. A shopper's prompt is distinct from indirect prompt injection in an untrusted review.
- [x] Confirm the final Alice JSON response and order card on the hosted site. It showed Bob's fictional address and invalid demo payment label, with a matching `orders.read / allow / succeeded` SOC event. No real card number is stored.
- [x] Commit and merge the tested feature branch into `master`; keep `.env.local`, Terraform state, plans, generated packages and credentials out of Git.

## 2. Release the protected agent to the existing AWS store

- [x] Build a Python 3.12 Linux Lambda package containing Strands/OpenAI and a production React build. The current package is 30.3 MiB zipped and 68.3 MiB unzipped.
- [x] Verify the intended AWS account (`783582650755`), Ohio region, active Lambda and current $5 monthly budget. AWS cost reporting can lag.
- [x] Run and inspect the real Terraform plan using the existing private state. The saved plan added a managed Groq secret and narrowly scoped permission, updated Lambda and site objects, and replaced only obsolete hashed assets.
- [x] Provision the Groq key privately as a secret value. It is not in Terraform state, Lambda environment values, frontend code, logs, chat or Git.
- [x] Apply the reviewed protected build and verify the public CloudFront homepage, catalog and signed-out assistant rejection. The exact plan applied with 4 adds, 2 updates and 2 deletes.
- [x] Sign in privately as both Alice and Bob. Each saw their own order through the API, and each agent request for the other's named order returned HTTP 200 with no leaked address plus `orders.read / deny / blocked` under the assistant request ID.
- [x] Rehearse Bob and Alice shopping, cart, fictional checkout, own-order lookup and cross-account security outcomes in separate hosted store sessions, with SOC checks at the two security handoffs.
- [ ] Finish a separate resilience pass for response time, provider failures, session expiry, account-switch edge cases and narrow-screen keyboard/focus behavior.
- [ ] Check current AWS spend, Groq tier/rate limits, log retention and rollback. The $5 budget is an alert, not a spending cap; do not upgrade the AWS Free plan or Groq paid tier for this project.

## 3. Build the controlled vulnerable profile on the same AWS website

- [x] Deploy a default-off server-side flag, administrator-managed Cognito group definition, and UTC end time check. Only the approved Alice demo session can select the vulnerable agent profile; missing configuration or group access fails closed. In the approved AWS classroom deployment, the flag is on, Alice is the sole demo-group member, and the profile expires at the end of December 12, 2026 Pacific. Bob's protected check passed after SOC deployment.
- [x] Locally implement the deliberately weak **agent** order lookup for named Bob orders with the synthetic transaction marker, including newly placed orders. A system-prompt change alone cannot bypass the mandatory `StoreService` ownership check. Normal `/api/orders/{id}` ownership enforcement remains intact for everyone.
- [x] Select `protected` / `vulnerable-demo` profiles server-side and record the profile in audit traces. The shopper-facing chat does not show a vulnerability label. No prompt text, request field or browser switch can select a mode; the approved AWS deployment enables only Alice through the semester.
- [x] Rehearse Alice's synthetic fixture with the configured Groq model locally: the named-order tool ran, Bob's fictional address appeared in Alice's agent reply, and the Strands callback no longer printed the address to console logs.
- [x] Verify both protected hosted directions after the default-off release. Bob's request for Alice's order and Alice's request for Bob's each produced `orders.read / deny / blocked` with no other-customer address. Alice's first attempt was inconclusive; the refined prompt and hosted recheck passed.
- [x] Use only existing fictional Alice/Bob addresses and orders. Do not add real payment information or plausible card numbers.
- [x] Restrict the vulnerable profile to Alice, named Bob orders with the synthetic transaction marker, and an administrator-set end date. The live Lambda reports `2026-12-13T07:59:59Z`, and Cognito lists only Alice in the demo group. Existing API throttles apply. Local tests cover Bob and failed/expired group checks.
- [x] Rehearse Bob's protected attempt against Alice and Alice's controlled demo attempt against Bob's newly placed order. The hosted browser and SOC audit confirmed Bob's denial, Alice's allowed read, the visible assistant replies, and the ordinary order page's continuing denial for Alice.
- [ ] Add an optional indirect injection fixture in an attacker-controlled synthetic product review; test it separately from direct shopper prompts.

## 4. Deploy and connect the SOC dashboard

- [x] Local dashboard renders labeled sample events, validates the v1 audit contract and groups assistant/store events by request ID.
- [x] Add a bounded recent-events query using the audit table's `by_time` index. New audit writes carry timeline keys; older records without those keys do not appear in this feed.
- [x] Deploy a separate read-only reporting Lambda and IAM role. The store Lambda stays audit-write-only. The reviewed 2026-11-05 SOC plan applied with 23 additions, 3 updates and no deletions.
- [x] Complete managed operator sign-in and hosted verification. Cognito confirms `soc-operator` belongs to `agentguard-soc-operators`. The static sign-in page is public; anonymous feed and health requests returned 401. The paired Alice/Bob traces were later verified in the private hosted dashboard.
- [x] Correlate `assistant.profile`, `orders.read`, and `assistant.message` v1 events by request ID without placing prompts, addresses, cookies or keys into audit events. Display authorization decision separately from execution. Verify visible exposure separately from audit evidence.
- [x] Verify operator sign-in, live Overview, Audit explorer and the paired Bob/Alice order-tool traces. Bob's blocked read appears green; Alice's successful cross-account read appears red in the comparison card and Audit explorer. **View audit event** opens the correlated request without manual filter entry.
- [ ] Complete remaining SOC interaction checks: confirm a fresh event appears on the 15-second visible-tab poll, paginate through a larger result set, and recheck request-ID lookup after a new presentation reset.

## 5. Final demo and submission

- [x] Record the audience story, exact Bob/Alice prompts, order steps, SOC click path, security terms and conclusions in the [Presentation Demo Guide](presentation-demo-guide.md). The hosted Alice path and green/red dashboard comparison were rehearsed.
- [x] Ship the collapsible right-side assistant panel, product images in recommendations and order cards, and a **New chat** control. Verify the hosted layout and Alice's JSON order card.
- [x] Run the full Python, store and dashboard suites and production builds after the final release: 81 Python tests, 17 store tests, 12 dashboard tests, and both builds passed on November 11, 2026. Hosted Bob/Alice security outcomes were rechecked.
- [ ] Have all three teammates perform the complete presentation in order and capture each person's speaking handoff.
- [ ] Document architecture, AWS services actually used, model provider (Groq), deployment revision, URLs, cost observations, known limitations and each teammate's contribution.
- [ ] Capture screenshots or exports with synthetic data only. Document lab reset and teardown, then remove resources no longer needed.

Deployment details: [AWS runbook](aws-deployment.md). API and audit contracts: [contracts](contracts.md). Dashboard limits: [SOC plan](soc-dashboard.md). Security acceptance: [assistant threat model](assistant-security.md).
