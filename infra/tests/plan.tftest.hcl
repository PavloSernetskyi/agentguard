# These tests mock AWS. They do not contact an account or prove deploy permissions.
mock_provider "aws" {}
variables {
  account_id   = "123456789012"
  budget_email = "test@example.com"
}
run "protected_store_plan" {
  command = plan
  assert {
    condition     = aws_s3_bucket_public_access_block.site.block_public_policy && aws_s3_bucket_public_access_block.site.restrict_public_buckets
    error_message = "Website bucket must stay private."
  }
  assert {
    condition     = aws_lambda_function.api.environment[0].variables["AUTH_MODE"] == "cognito"
    error_message = "Cloud must never use local demo authentication."
  }
  assert {
    condition     = aws_lambda_function.api.environment[0].variables["DEMO_VULNERABLE_ENABLED"] == "false" && length(aws_cognito_user_group.demo) == 0
    error_message = "The vulnerable classroom profile must default to disabled."
  }
  assert {
    condition     = aws_cloudfront_distribution.site.ordered_cache_behavior[0].cache_policy_id == "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    error_message = "API responses must not be cached."
  }
  assert {
    condition     = aws_cognito_user_pool.demo.admin_create_user_config[0].allow_admin_create_user_only
    error_message = "Public sign-up must be disabled."
  }
  assert {
    condition     = aws_budgets_budget.demo.limit_amount == "5" && length(aws_budgets_budget.demo.notification) == 3
    error_message = "Keep the reviewed $5 target and three alerts."
  }
  assert {
    condition     = aws_cloudwatch_log_group.lambda.retention_in_days == 7 && aws_dynamodb_table.store.billing_mode == "PAY_PER_REQUEST"
    error_message = "Keep bounded log retention and on-demand database capacity."
  }
  assert {
    condition     = contains([for index in aws_dynamodb_table.audit.global_secondary_index : index.name], "by_time") && aws_iam_role.soc.name != aws_iam_role.lambda.name
    error_message = "SOC must use the bounded audit index and a separate role."
  }
  assert {
    condition     = aws_cloudfront_distribution.site.ordered_cache_behavior[1].cache_policy_id == "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    error_message = "Operator API responses must never be cached at CloudFront."
  }
}

run "approved_demo_plan" {
  command = plan
  variables {
    demo_vulnerable_enabled   = true
    demo_vulnerable_until_utc = "2099-01-01T00:00:00Z"
  }
  assert {
    condition     = length(aws_cognito_user_group.demo) == 1 && length(aws_cognito_user_in_group.demo_alice) == 1
    error_message = "An administrator-approved demo must enroll only Alice."
  }
  assert {
    condition     = aws_lambda_function.api.environment[0].variables["DEMO_VULNERABLE_UNTIL_UTC"] == "2099-01-01T00:00:00Z"
    error_message = "The agent must receive the administrator's UTC end time."
  }
}
