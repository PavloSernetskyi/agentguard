# Person 1: DemoMart AWS infrastructure

Terraform and backend cloud adapters are prepared, but **not deployed**. AWS MCP connects successfully; organization policy currently denies reads for the required services in `us-east-1`. See the [deployment runbook](../docs/aws-deployment.md) for the exact blocker, validation evidence, resource inventory, cost target and remaining steps.

The target is one serverless store with a $5/month budget target: private S3/CloudFront, HTTP API/Lambda, DynamoDB, Cognito, short-retention logs and budget alerts. This excludes AI inference and SOC hosting.

Build artifacts first with `scripts/prepare-cloud.ps1`, then run Terraform init, validate and test. Tests use a mocked AWS provider and create no cloud resources. A real authenticated plan and cost review must precede apply.

Commit `.terraform.lock.hcl`. Never commit state, secret tfvars, generated plans, local tools, deployment artifacts or credentials. `terraform.tfvars.example` documents inputs without private values.

Person 2 can implement the agent locally now using `StoreService`; a hosted handoff still requires resolving account access, applying the reviewed plan, provisioning private demo accounts, seeding synthetic data and passing hosted acceptance checks.
