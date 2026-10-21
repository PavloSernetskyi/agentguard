# Person 1: AWS infrastructure (milestone 2)

Milestone 1 works locally. AWS deployment and AWS MCP setup have not started. Follow the [AWS phase guide](../docs/aws-next-phase.md) and [team roadmap](../docs/team-roadmap.md).

Next deliverables:

1. Confirm the school account, region, budget and least-privilege access. Connect the selected AWS MCP tool for developer use and verify identity with read-only discovery.
2. Write Terraform for frontend hosting/CDN, API Gateway, Python Lambda, DynamoDB and the agreed audit destination; document environment inputs and teardown.
3. Implement/test the Lambda and DynamoDB adapters with the existing authorization invariants.
4. Configure suitable authentication, HTTPS cookies, secrets, logs and rate limits for hosted use.
5. Coordinate the Strands/Groq runtime with Person 2; evaluate Bedrock AgentCore separately from model inference.
6. Deploy the store and assistant and repeat Alice/Bob checks through both paths.

In milestone 3, provide the isolated, restricted testing lab and reset fixtures. In milestone 4, host the operator-only SOC dashboard and finalize the demo/teardown runbook.

Commit `.terraform.lock.hcl` when generated. Never commit Terraform state, secret tfvars, plan files or credentials. Use documented placeholders for required values. No infrastructure is created by these planning documents.
