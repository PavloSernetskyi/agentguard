# Person 1 AWS deployment runbook

## Current status

Local cloud preparation is implemented and tested. **The store is not deployed and milestone 2 is not complete.** No AWS resources have been created by this work.

AWS MCP authentication succeeded. However, the selected Happy Path account returned an explicit organization service-control-policy (SCP) denial for these read-only calls in `us-east-1`:

- `lambda:GetAccountSettings` and `lambda:ListFunctions`
- `dynamodb:ListTables`
- `cognito-idp:ListUserPools`
- `apigateway:GET` on `/apis`

Policy ID reported: `p-r08ib3ie`. The full policy contents and cause have not been inspected. Do not assume this is a free-tier limitation or upgrade billing to fix it. Ask the account/organization administrator whether the selected account/project and region are approved for this architecture. Do not try alternate credentials or regions to evade the policy. No create/update calls were attempted.

A role named AccountFullAccessRole does not establish effective permissions. IAM allows cannot override an organization-level explicit deny.

## Reviewed scope and cost target

One demo environment in `us-east-1`, with a $5/month target for the store. This is not a spending cap. Planning estimate remains approximately $1-$5/month for 100,000 API requests, 512 MB Lambda at 300 ms average, 10 GB delivery, small DynamoDB tables and 0.5 GB logs; it is not a measured bill. AI inference, AgentCore, SOC hosting, taxes, domain registration and penetration-test load are excluded.

Sources: [API Gateway](https://aws.amazon.com/api-gateway/pricing/), [Lambda](https://aws.amazon.com/lambda/pricing/), [DynamoDB](https://aws.amazon.com/dynamodb/pricing/), [S3](https://aws.amazon.com/s3/pricing/), [CloudFront](https://aws.amazon.com/cloudfront/pricing/), [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/), [Cognito](https://aws.amazon.com/cognito/pricing/).

Terraform declares:

- A private S3 bucket, encryption, public-access block, CloudFront read policy and built website objects.
- One CloudFront distribution using pay-as-you-go, OAC for S3, and an API origin request policy. It caches static assets but disables API caching. There is no custom domain, WAF subscription or blanket API-error rewrite.
- One HTTP API, Lambda integration, general API route, login route, default stage and Lambda invocation permission.
- One Python 3.12 Lambda (512 MB, 10-second timeout), a role and resource-scoped inline permissions. No VPC, NAT gateway, EC2 instance or provisioned concurrency.
- Two on-demand DynamoDB tables: store and audit. Store has an owner index. Session/audit expiry uses TTL; authorization checks session expiry directly, without relying on delayed TTL deletion.
- One admin-created-user-only Cognito pool and app client. No public signup or committed passwords.
- Two CloudWatch log groups with seven-day retention.
- One account-wide monthly $5 budget with actual-spend alerts above $1/$3/$5, excluding credits/refunds so underlying usage remains visible. A private notification email is required before applying.

Throttles: API target 2 requests/second, burst 5; login 0.5 requests/second, burst 2. DynamoDB throughput maxima also limit capacity. These controls can return throttling errors and are not billing caps. Login may require a brief wait during rapid Alice/Bob switching.

Lambda reserved concurrency is unset (`-1`) until the account quota is known; a reservation of 5 is supported by the configuration only if the quota permits it. The quota read was denied, so do not claim a concurrency limit has been configured.

## Prepare and verify locally

Requirements: Python 3.12+, Node.js 22+, Terraform >=1.14,<2. The initial preparation used Terraform 1.14.9 in ignored `.tools/terraform/`; a fresh checkout must install Terraform or provide that executable. The provider version is committed in `infra/.terraform.lock.hcl`.

From the root:

```powershell
python -m unittest discover -s tests -v
cd store
npm ci
cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-cloud.ps1
python scripts/prepare_seed.py
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
terraform -chdir=infra test
```

If using the downloaded local executable, substitute `.tools/terraform/terraform.exe` for `terraform`. The build produces ignored `artifacts/backend.zip`, `artifacts/store/` and `artifacts/seed-items.json`. The frontend build sets `VITE_AUTH_MODE=cognito`, removing the prefilled/public local demo passwords. The Lambda uses the AWS-runtime-provided boto3 SDK; local stdlib tests use mock clients, not live Cognito or DynamoDB.

Validation completed: 19 Python tests, production cloud frontend build, Terraform validate, and one Terraform mocked plan test covering six infrastructure invariants. Terraform emits deprecation warnings for DynamoDB key arguments accepted by the pinned provider. The test provider is mocked: it cannot verify AWS permissions, quotas, service availability or an actual deployable account plan. **No authenticated Terraform plan has been produced.**

## Unblock, plan and review

1. Resolve the SCP restriction with the account administrator, then repeat read-only service checks through AWS MCP. Confirm account, region, service availability and Lambda quotas.
2. Provide the budget email privately. Copy `infra/terraform.tfvars.example` to ignored `infra/terraform.tfvars` and set the expected account ID and email. No passwords or API keys belong there.
3. Terraform needs an approved credential source of its own. MCP OAuth sign-in does not automatically supply local Terraform credentials. Configure short-lived credentials using the approved AWS sign-in workflow; do not extract MCP tokens or commit credentials.
4. Prepare the artifacts, then run an authenticated Terraform plan into ignored `infra/deploy.tfplan`. Review every resource, the account ID, cost assumptions and teardown scope. Do not apply a mock plan or bypass the account guard.
5. Apply only the reviewed real plan. Keep local state private and backed up. Before another teammate applies Terraform, migrate to a shared encrypted state backend with locking; this draft intentionally starts with local state for one operator.

No implementation in this runbook disables or alters the SCP.

## Initial data and credentials after deployment

The Lambda never auto-seeds on startup and has no HTTP reset/admin route.

1. Use administrator AWS MCP operations to put the 14 generated AttributeValue records from `artifacts/seed-items.json` into the Terraform output `store_table`. The file contains only synthetic data. For first-time seeding, use `attribute_not_exists(pk)` conditions to avoid overwriting an existing project.
2. Create Cognito usernames `alice` and `bob` in `cognito_pool_id`, suppress outbound invitations, and assign each a distinct private permanent password via a secure administrator workflow. Do not use the published local demo passwords, put passwords in Terraform, or print passwords into tool logs. This step remains manual until an approved secret-entry workflow is established.
3. Read each created user's immutable Cognito `sub`. Add a store record with `pk=identities`, `sk=<sub>`, and `value={customer_id: alice}` or `bob`. This is an administrator-owned mapping; request bodies and agent prompts cannot set it.
4. Users sign in through the store's `/api/session` route. The backend calls Cognito and GetUser, resolves the trusted `sub`, then issues an opaque hashed-store session. Cognito tokens are never returned to the browser. Cloud cookies are Secure, HttpOnly and SameSite=Strict.
5. New-password/MFA challenges are currently rejected, not completed in the store UI; administrator provisioning must finish account setup before handoff. Store sessions last one hour and logout revokes them. Disabling a Cognito user alone does not immediately revoke an already-issued store session: an administrator must remove that customer's sessions or wait for expiry.

## Hosted acceptance gate

- Visit the Terraform `website_url` output over HTTPS; inspect search, filters, detail pages and mobile layout.
- Sign in as Alice with the private password. Public local passwords must fail. Add/change/remove a cart item and verify persistence after reload.
- Alice reads `ord-alice-001`; directly requesting `ord-bob-001` returns 403 without any Bob details. Repeat the reciprocal checks as Bob.
- Switching accounts changes both cart and orders; logout revokes the current session.
- Use the API `X-Request-Id` to query the audit table's `request_id` partition as an operator. The original v1 event is in `value`; TTL is table metadata. Check allow/succeeded and deny/blocked independently.
- Check no private response or Set-Cookie is cached through CloudFront. Check untrusted origins cannot mutate state.
- Verify budget notification delivery, throttles and log retention. No passwords/cookies should appear in logs.
- Record URL, region, deployed revision and test evidence in the team handoff. Only then mark Person 1's hosted-store task complete.

Audit writes are append-only for the application role. They are still not atomic with store mutations: if the audit write fails after a cart mutation, the API can return an error even though the mutation persisted. A transactional outbox remains future work. Order-list GSI results are eventually consistent; individual order checks use strongly consistent primary reads and always enforce ownership.

## Reset and teardown

Local `python -m seed.reset` only affects SQLite, never AWS. A cloud reset must be an explicit operator procedure scoped to these Terraform outputs, with audit export if needed. Do not delete arbitrary account tables/buckets.

For teardown, first review `terraform plan -destroy`, preserve any required report evidence, then destroy only this stack. CloudFront deletion can take time. Terraform manages uploaded objects; S3 `force_destroy=false` prevents silently deleting unexpected bucket contents. Cognito users and any manually uploaded objects must be accounted for in teardown. State files remain sensitive and must stay out of GitHub.
