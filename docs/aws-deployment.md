# Person 1 AWS deployment runbook

## Current status

**Archery Pro Shopping** is deployed at **https://d16nqulwj27ltb.cloudfront.net** in Ohio (`us-east-2`). The assistant backend, storefront chat and documentation are now included in `master`, but this AWS deployment has not yet been updated to that build. The previous hosted Alice/Bob ownership check passed in both directions and was audited. After assistant deployment, repeat those browser checks and a fictional checkout; private passwords were not used in automated post-rollout checks. The full milestone 2 remains incomplete until hosted assistant acceptance passes.

The storefront was previously named Daywell Market. The new cloud build uses **Archery Pro Shopping** and shows customers simply as Alice and Bob. Existing `demomart-*` AWS resource names, cookie name, order IDs and schema identifier are retained to avoid replacing live infrastructure or breaking the integration contract. The public URL did not change.

On 2026-10-26, the reviewed archery rollout plan showed **21 creates, 2 in-place changes, 2 deletes**: a Lambda code update, new hashed JS/CSS and 19 WebP images, an updated homepage, and removal of the two obsolete hashed assets. No table, identity provider, API or distribution was replaced. The plan applied with those exact counts. A guarded DynamoDB sync updated 18 synthetic products and the two original demo orders; it preserved customers, sessions, carts, other orders and audit history. Ignored local backups are in `infra/terraform.pre-archery.tfstate.backup` and `artifacts/archery-catalog-backup.json`. The CloudFront homepage invalidation completed. The public homepage returned HTTP 200 with the new asset hashes; `/api/products` returned 18 archery items including a 10 lb beginner recurve; the hero image returned HTTP 200 as `image/webp`. An unauthenticated order request returned 401 and its matching audit row recorded `orders.read` / `deny` / `blocked`. The production build and 21 Python tests passed.

AWS MCP authentication and read-only service checks succeeded on 2026-10-25 in the project's assigned region, **Ohio (`us-east-2`)**. Lambda, DynamoDB, Cognito and API Gateway returned empty resource lists. Lambda reported 400 total and 400 unreserved concurrent executions.

The earlier explicit SCP denials occurred in `us-east-1`, outside this simplified AWS project's assigned region. The user confirmed Ohio in AWS Settings. We are using that approved region; no organization policy was changed. See [AWS project-region documentation](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html).

AWS MCP and the local AWS CLI profile are connected. Never send access keys or passwords in chat.

On 2026-10-25, the initial authenticated Terraform plan for account `783582650755` and region `us-east-2` showed **26 create, 0 change, 0 destroy**. It applied successfully. The plan, state, budget email and deployment inputs are ignored locally. Fourteen synthetic items (ten products, two customers, two orders) were initially seeded; the catalog and original orders were updated in the 2026-10-26 rollout above. Cognito users `alice` and `bob` and their immutable-sub identity mappings were created. The owner set private permanent passwords using the no-echo local script. That script reported own-order 200 and cross-order 403 for each user; independent AWS reads confirmed both Cognito users `CONFIRMED` and the four matching durable audit decisions. AWS Budgets reports the $5 monthly budget.

Deployed inventory: one HTTP API, integration, two routes and stage; one $5 monthly account-wide budget with $1/$3/$5 actual-spend email notifications; one CloudFront distribution with S3 origin access control and API origin request policy; two seven-day log groups; one Cognito user pool and client; two on-demand DynamoDB tables; one Lambda role and policy, one 512 MB Lambda with five reserved concurrent executions and API invocation permission; one private encrypted S3 bucket, public-access block, bucket policy and three built site objects. Terraform showed deprecation warnings for DynamoDB `hash_key`/`range_key`, accepted by the pinned provider.

To unblock local planning, install [AWS CLI v2 for Windows](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), then use the [browser-based local development sign-in](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html):

```powershell
aws login --profile agentguard --region us-east-2
```

Choose the existing AgentGuard project session. Keep credentials in the local AWS credential store, not chat or Git. After sign-in, run Terraform with `AWS_PROFILE=agentguard`; if the pinned provider cannot consume the login session directly, use the documented separate `credential_process` profile. Do not run credential export into terminal output. Review the resulting real plan before applying.

## Reviewed scope and cost target

On 2026-10-25 the AWS Free Tier `GetAccountPlanState` API reported account `783582650755` as `FREE`, `ACTIVE`, with `$100.00` initially and `$140.00` remaining after deployment, and expiration on 2027-04-18 UTC. AWS may grant additional credits for onboarding activities; the additional $40 is reported by AWS, not a payment. The user requires **no personal-money spend**. Keep the project on the Free plan; do not upgrade to Paid or activate features that automatically upgrade it. AWS says Free-plan usage is covered by credits and the account closes when the credits or six-month plan ends, whichever comes first. The $5 budget below is an early warning, **not** a hard cap. A Paid plan changes this protection and is outside the user's authorization. See [AWS account plan rules](https://docs.aws.amazon.com/us_en/awsaccountbilling/latest/aboutv2/free-tier-plans.html).

One demo environment in `us-east-2`, with a $5/month target for the store. This is not a spending cap. Planning estimate remains approximately $1-$5/month for 100,000 API requests, 512 MB Lambda at 300 ms average, 10 GB delivery, small DynamoDB tables and 0.5 GB logs; it is not a measured bill. This estimate was initially based on Northern Virginia pricing; monitor actual Ohio usage against the budget. AI inference, AgentCore, SOC hosting, taxes, domain registration and penetration-test load are excluded.

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

Lambda reserved concurrency is unset (`-1`) until the account quota is known; a reservation of 5 is supported by the configuration only if the quota permits it. The Ohio quota read succeeded (400 total/unreserved), so a reservation of 5 can be selected in the actual deployment inputs. No concurrency limit has been applied yet.

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

Validation completed for the archery rollout: 21 Python tests, production cloud frontend build, Terraform validate, and the real authenticated plan and apply described above. Terraform emits deprecation warnings for DynamoDB key arguments accepted by the pinned provider.

## Unblock, plan and review

1. Completed: verify the project account, Ohio region, core service read access and Lambda quota. Next check access to global services and confirm the remaining deployment permissions without changing organization policies.
2. Provide the budget email privately. Copy `infra/terraform.tfvars.example` to ignored `infra/terraform.tfvars` and set the expected account ID and email. No passwords or API keys belong there.
3. Terraform needs an approved credential source of its own. MCP OAuth sign-in does not automatically supply local Terraform credentials. Configure short-lived credentials using the approved AWS sign-in workflow; do not extract MCP tokens or commit credentials.
4. Prepare the artifacts, then run an authenticated Terraform plan into ignored `infra/deploy.tfplan`. Review every resource, the account ID, cost assumptions and teardown scope. Do not apply a mock plan or bypass the account guard.
5. Apply only the reviewed real plan. Keep local state private and backed up. Before another teammate applies Terraform, migrate to a shared encrypted state backend with locking; this draft intentionally starts with local state for one operator.

No implementation in this runbook disables or alters the SCP.

## Initial data and credentials after deployment

The Lambda never auto-seeds on startup and has no HTTP reset/admin route.

For the archery rollout, `scripts/sync_archery_catalog.py` reads the existing table and reports the intended changes by default. Its `--apply` flag updates only the 18 catalog products and the two original synthetic demo orders, after checking the expected AWS account, region, table and existing values. It backs up replaced records under ignored `artifacts/` before writing. The script reported `Already in sync` after the rollout. It is not a general cloud reset and does not alter identities, sessions, carts, user-created orders or audit events.

1. Use administrator AWS MCP operations to put the 14 generated AttributeValue records from `artifacts/seed-items.json` into the Terraform output `store_table`. The file contains only synthetic data. For first-time seeding, use `attribute_not_exists(pk)` conditions to avoid overwriting an existing project.
2. In an ignored virtual environment install `boto3` and `botocore[crt]` (the latter lets boto3 use AWS CLI browser login), then run `python scripts/provision_demo_users.py` in an interactive private terminal. The current `.venv` already has these dependencies. Add `--user bob` (or `alice`) to retry just one account. The script prompts without echo for distinct private permanent passwords, sets Cognito usernames without invitations, and never stores or prints passwords. Do not use the published local demo passwords or put passwords in Terraform, chat, or Git. This script is scoped to the current project account, pool, tables and website URL. It also checks each user's own-order 200, cross-order 403 and matching audit events.
3. The script reads each user's immutable Cognito `sub` and conditionally adds `pk=identities`, `sk=<sub>`, `value={customer_id: alice|bob}`. This administrator-owned mapping cannot be set by request bodies or agent prompts.
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
