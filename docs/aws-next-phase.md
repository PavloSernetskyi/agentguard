# Milestone 2: Person 1 AWS deployment phase

Milestone 1 is complete. AWS MCP is connected and the DemoMart store infrastructure is deployed at **https://d16nqulwj27ltb.cloudfront.net** in the assigned Ohio region (`us-east-2`). Synthetic catalog and orders are seeded, and Person 1's hosted Alice/Bob ownership and audit acceptance passed. See the [current deployment runbook](aws-deployment.md). Persons 2 and 3 build the assistant and SOC integration next; see the [team roadmap](team-roadmap.md).

## Connection session

1. Confirm the school sandbox account, region, spending limit, permitted services and access method. Use a dedicated least-privilege role and short-lived authentication where available. Never paste access keys into chat or commit them.
2. Identify the actual AWS MCP server and the client where it will run. Follow its current official installation/authentication instructions; verify the tool publisher and requested permissions before connecting. The official AWS MCP server is connected in the developer environment; no credentials or personal MCP configuration are committed.
3. Begin with read-only tools. Verify account identity and region, inspect existing resources, and record the intended deployment scope. AWS MCP helps the developer manage infrastructure; the shopping assistant must not receive these tools.

## Implementation and deployment

4. Prepare a Terraform plan under `infra/`: static frontend hosting/CDN, API Gateway plus Python Lambda, DynamoDB indexes for customer-owned records and an agreed durable audit destination. Prefer a single browser origin with `/api` routed to the backend.
5. Add Lambda and DynamoDB adapters; retain the same service authorization checks. Test session expiration/revocation, order ownership, cart isolation and audit behavior against the cloud adapters.
6. Replace public local demo sign-in for hosted exposure with deployment-appropriate authentication or restrict the demo to approved participants. Add HTTPS/Secure cookies, allowed origins, request limits, secret handling, logs and a seed/reset procedure.
7. With Person 2, decide how to host Strands using Groq inference. Evaluate Bedrock AgentCore as a runtime; confirm model/tool compatibility, costs and runtime identity before provisioning. Store the Groq key server-side in managed secrets. Bedrock-hosted inference would be a separate provider choice.
8. Review the concrete Terraform plan, estimated cost and teardown procedure before applying it. Document outputs and configuration names without secret values.
9. Deploy; give Persons 2 and 3 the service URL and authentication/event contracts. Integrate the real Ask DemoMart interface and run the milestone 2 acceptance checklist in the roadmap.

## Completion and later phases

Milestone 2 requires a working hosted store and real assistant, with own-order access and cross-account denials verified through both interfaces and recorded durably. Refund requests remain synthetic and require their own authorized/confirmed operation; payment processing and checkout remain deferred.

Milestone 3 adds a separate restricted test lab, not a bypass on the public store. Milestone 4 adds operator-only SOC hosting and the final demo runbook. Coordinate any vulnerable fixture with Person 2 using [contracts](contracts.md); neither request parameters nor assistant prompts can activate it.
