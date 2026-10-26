# Person 1: Daywell Market AWS infrastructure

Terraform and backend cloud adapters are deployed in Ohio (`us-east-2`). The website is at **https://d16nqulwj27ltb.cloudfront.net**. The AWS account remains on its active Free plan. See the [deployment runbook](../docs/aws-deployment.md) for status, validation evidence, resource inventory, cost target and remaining steps.

The target is one serverless store with a $5/month budget target: private S3/CloudFront, HTTP API/Lambda, DynamoDB, Cognito, short-retention logs and budget alerts. This excludes AI inference and SOC hosting.

Build artifacts first with `scripts/prepare-cloud.ps1`, then run Terraform init, validate and test. Tests use a mocked AWS provider and create no cloud resources. A real authenticated plan and cost review must precede apply.

Commit `.terraform.lock.hcl`. Never commit state, secret tfvars, generated plans, local tools, deployment artifacts or credentials. `terraform.tfvars.example` documents inputs without private values.

Person 2 can implement the agent using `StoreService` and the hosted API contracts. The infrastructure plan was applied, synthetic data was seeded, and the hosted Alice/Bob ownership and audit checks passed. Keep private demo passwords out of chat and Git. Changes to Terraform must use the original private state or a migrated shared encrypted state backend; never apply from a fresh checkout with empty state.
