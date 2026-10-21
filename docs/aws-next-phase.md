# Separate AWS phase (not started)

The local milestone comes first. Nothing in this repository configures AWS MCP, provisions resources, or deploys the application.

In the next session:

1. Choose the school sandbox AWS account, region, spending limit, and approved access method. Use a dedicated role with least privilege; never paste access keys into chat or commit them.
2. Identify the AWS MCP server and client integration your school intends to use. Verify its current official installation and authentication instructions before configuring it. Start with read-only account/resource discovery and confirm the account identity.
3. Agree on a Terraform plan: static frontend hosting, API Gateway and Lambda, DynamoDB tables/indexes for customers, sessions, orders and carts, plus the teammate-approved audit destination. Keep Terraform in `infra/`.
4. Add the Lambda adapter and DynamoDB implementation. Replace local demo sign-in for any public deployment, enable secure HTTPS cookies, and update the allowed origin configuration. Re-run the same authorization tests against the adapter.
5. Review Terraform's concrete plan, estimated cost, logs, secret handling and teardown procedure before applying it.
6. Deploy and repeat Alice/Bob acceptance checks. Bedrock with Strands, refund requests, and assistant review summaries remain a later milestone.

Coordinate administrator-controlled vulnerable fixtures with Person 2 using the constraints in `contracts.md`. Such fixtures must never be selectable through an HTTP parameter or assistant prompt.
