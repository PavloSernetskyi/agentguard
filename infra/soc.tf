resource "aws_cognito_user_group" "soc" {
  name         = "agentguard-soc-operators"
  user_pool_id = aws_cognito_user_pool.demo.id
  description  = "Read-only SOC evidence operators"
}

resource "aws_cognito_user_pool_client" "soc" {
  name                          = "${var.name}-soc"
  user_pool_id                  = aws_cognito_user_pool.demo.id
  generate_secret               = false
  explicit_auth_flows           = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 1
  id_token_validity             = 1
  refresh_token_validity        = 1
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

resource "aws_cloudwatch_log_group" "soc" {
  name              = "/aws/lambda/${var.name}-soc"
  retention_in_days = 7
}

resource "aws_iam_role" "soc" {
  name               = "${var.name}-soc"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}

resource "aws_iam_role_policy" "soc" {
  name = "read-audit-timeline-only"
  role = aws_iam_role.soc.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = "${aws_dynamodb_table.audit.arn}/index/by_time" },
      { Effect = "Allow", Action = ["cognito-idp:AdminListGroupsForUser"], Resource = aws_cognito_user_pool.demo.arn },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.soc.arn}:*" }
    ]
  })
}

resource "aws_lambda_function" "soc" {
  function_name                  = "${var.name}-soc"
  role                           = aws_iam_role.soc.arn
  runtime                        = "python3.12"
  handler                        = "backend.soc_cloud.handler"
  filename                       = "${path.module}/../artifacts/soc.zip"
  source_code_hash               = filebase64sha256("${path.module}/../artifacts/soc.zip")
  memory_size                    = 128
  timeout                        = 10
  reserved_concurrent_executions = var.lambda_reserved_concurrency
  environment {
    variables = {
      AUDIT_TABLE           = aws_dynamodb_table.audit.name
      COGNITO_POOL_ID       = aws_cognito_user_pool.demo.id
      COGNITO_SOC_CLIENT_ID = aws_cognito_user_pool_client.soc.id
      PUBLIC_ORIGIN         = "https://${aws_cloudfront_distribution.site.domain_name}"
    }
  }
  depends_on = [aws_iam_role_policy.soc]
}

resource "aws_apigatewayv2_integration" "soc" {
  api_id                 = aws_apigatewayv2_api.store.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.soc.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 12000
}

resource "aws_apigatewayv2_route" "soc" {
  api_id    = aws_apigatewayv2_api.store.id
  route_key = "ANY /soc-api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.soc.id}"
}

resource "aws_apigatewayv2_route" "soc_session" {
  api_id    = aws_apigatewayv2_api.store.id
  route_key = "POST /soc-api/session"
  target    = "integrations/${aws_apigatewayv2_integration.soc.id}"
}

resource "aws_apigatewayv2_route" "soc_logout" {
  api_id    = aws_apigatewayv2_api.store.id
  route_key = "DELETE /soc-api/session"
  target    = "integrations/${aws_apigatewayv2_integration.soc.id}"
}

resource "aws_lambda_permission" "soc_gateway" {
  statement_id  = "AllowSocGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.soc.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.store.execution_arn}/*/*/soc-api/*"
}

resource "aws_s3_object" "soc" {
  for_each      = fileset("${path.module}/../artifacts/dashboard", "**")
  bucket        = aws_s3_bucket.site.id
  key           = "soc/${each.value}"
  source        = "${path.module}/../artifacts/dashboard/${each.value}"
  etag          = filemd5("${path.module}/../artifacts/dashboard/${each.value}")
  content_type  = lookup(local.mime_types, reverse(split(".", each.value))[0], "application/octet-stream")
  cache_control = each.value == "index.html" ? "no-cache,max-age=0,must-revalidate" : "public,max-age=31536000,immutable"
}
