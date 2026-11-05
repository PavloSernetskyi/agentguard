# AgentGuard remaining work: ordered checklist

**Next rehearsal reminder:** before the final presentation, follow [the Bob/Alice demo script](demo-script.md) on the live store, check both support request IDs in the [SOC dashboard](https://d16nqulwj27ltb.cloudfront.net/soc/index.html), and confirm Bob's denial and Alice's synthetic demo access. Do not paste passwords or customer fixture text into team notes. Alice's approved classroom profile expires after December 12, 2026, Pacific time.

This is the execution checklist for the final Archery Pro Shopping demonstration. The protected store and agent are hosted in AWS Ohio (`us-east-2`) at https://d16nqulwj27ltb.cloudfront.net. Both private Alice/Bob cross-account agent checks passed; broader browser regression, the controlled demo profile and SOC release remain. All accounts, orders, addresses and test evidence must remain synthetic. The project owner will coordinate and implement the remaining work across the store, agent and SOC dashboard.

**Demo roles:** Bob (project owner) attempts to read Alice's order through the protected agent. Alice (teammate) attempts to read Bob's order through an intentionally vulnerable, administrator-enabled demo profile on the same AWS website. Person 3 presents the SOC traces. The normal store APIs continue to enforce ownership for both customers. An assistant prompt or request parameter cannot enable the demo profile.

## 1. Freeze the protected scenario and release inputs

- [x] Define `ord-alice-001` and `ord-bob-001` as the synthetic target orders. The existing backend checks ownership using the validated session.
- [x] Add a named-order agent tool that calls `StoreService.order`, omits the address from model data, and audits cross-account denials. Local assistant and cloud-adapter tests pass.
- [x] Draft exact Bob and Alice prompts with expected HTTP/tool responses, audit decisions and visible UI behavior in [demo-script.md](demo-script.md). Rehearse the final wording with the team. A prompt typed by a shopper is a direct attack; an instruction planted in a review is an indirect prompt injection.
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

## 3. Build the controlled vulnerable profile on the same AWS website

- [x] Deploy a default-off server-side flag, administrator-managed Cognito group definition, and UTC end time check. Only the approved Alice demo session can select the vulnerable agent profile; missing configuration or group access fails closed. In the approved AWS classroom deployment, the flag is on, Alice is the sole demo-group member, and the profile expires at the end of December 12, 2026 Pacific. Bob's protected check passed after SOC deployment.
- [x] Locally implement the deliberately weak **agent** order lookup, limited to Bob's pre-existing synthetic fixture. A system-prompt change alone cannot bypass the mandatory `StoreService` ownership check. Normal `/api/orders/{id}` ownership enforcement remains intact for everyone.
- [x] Add trusted `protected` / `vulnerable-demo` labels to assistant replies and audit traces. No prompt text, request field or browser switch can select a mode. The code is deployed default-off; both private protected hosted checks passed.
- [x] Rehearse Alice's synthetic fixture with the configured Groq model locally: the named-order tool ran, Bob's fictional address appeared in Alice's agent reply, and the Strands callback no longer printed the address to console logs.
- [x] Verify both protected hosted directions after the default-off release. Bob's request for Alice's order and Alice's request for Bob's each produced `orders.read / deny / blocked` with no other-customer address. Alice's first attempt was inconclusive; the refined prompt and hosted recheck passed.
- [x] Use only existing fictional Alice/Bob addresses and orders. Do not add real payment information or plausible card numbers.
- [x] Restrict the vulnerable profile to Alice, the exact synthetic Bob order, and an administrator-set end date. The live Lambda reports `2026-12-13T07:59:59Z`, and Cognito lists only Alice in the demo group. Existing API throttles apply. Local tests cover Bob and failed/expired group checks; the hosted Alice exposure rehearsal remains.
- [ ] Rehearse Bob's protected attempt against Alice and Alice's controlled demo attempt against Bob. Independently confirm the demo agent returned Bob's synthetic data and the protected agent returned none.
- [ ] Add an optional indirect injection fixture in an attacker-controlled synthetic product review; test it separately from direct shopper prompts.

## 4. Deploy and connect the SOC dashboard

- [x] Local dashboard renders labeled sample events, validates the v1 audit contract and groups assistant/store events by request ID.
- [x] Add a bounded recent-events query using the audit table's `by_time` index. New audit writes carry timeline keys; older records without those keys do not appear in this feed.
- [x] Deploy a separate read-only reporting Lambda and IAM role. The store Lambda stays audit-write-only. The reviewed 2026-11-05 SOC plan applied with 23 additions, 3 updates and no deletions.
- [x] Complete managed operator sign-in and hosted verification. The user reported the private provisioning script verified, and Cognito confirms `soc-operator` belongs to `agentguard-soc-operators`. The static sign-in page is public; anonymous feed and health requests returned 401. Alice and Bob access still needs a private hosted check.
- [x] Correlate `assistant.profile`, `orders.read`, and `assistant.message` v1 events by request ID without placing prompts, addresses, cookies or keys into audit events. Display authorization decision separately from execution. Verify visible exposure separately from audit evidence.
- [ ] Finish SOC acceptance: visually check the operator dashboard, 15-second visible-tab refresh, pagination, request lookup, and a fresh trace from each scenario. The dashboard shell returned 200 at `/soc/index.html`; the user reported the private operator feed verification passed. A new hosted anonymous order read produced a `deny / blocked` event in the timeline index.

## 5. Final demo and submission

- [x] Record a short audience story and exact Bob/Alice prompts with SOC expectations in [demo-script.md](demo-script.md). Rehearsal of the hosted Alice path and visible dashboard comparison remains.
- [ ] Experiment on a separate feature branch with a collapsible right-side assistant panel that leaves the shop visible and gives order details more space. Preview locally and decide whether to merge or revert before any AWS release.
- [ ] Run the full Python, store and dashboard tests and production builds; repeat hosted Alice/Bob checks after the final release.
- [ ] Document architecture, AWS services actually used, model provider (Groq), deployment revision, URLs, cost observations, known limitations and each teammate's contribution.
- [ ] Capture screenshots or exports with synthetic data only. Document lab reset and teardown, then remove resources no longer needed.

Deployment details: [AWS runbook](aws-deployment.md). API and audit contracts: [contracts](contracts.md). Dashboard limits: [SOC plan](soc-dashboard.md). Security acceptance: [assistant threat model](assistant-security.md).
