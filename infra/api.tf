resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.name}-api"
  retention_in_days = 7
}
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${var.name}"
  retention_in_days = 7
}
resource "aws_iam_role" "lambda" {
  name               = "${var.name}-api"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "lambda" {
  name = "store-and-audit-only"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query"], Resource = [aws_dynamodb_table.store.arn, "${aws_dynamodb_table.store.arn}/index/by_owner"] },
      { Effect = "Allow", Action = ["dynamodb:PutItem"], Resource = aws_dynamodb_table.audit.arn },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.lambda.arn}:*" }
    ]
  })
}
resource "aws_lambda_function" "api" {
  function_name                  = "${var.name}-api"
  role                           = aws_iam_role.lambda.arn
  runtime                        = "python3.12"
  handler                        = "backend.lambda_handler.handler"
  filename                       = "${path.module}/../artifacts/backend.zip"
  source_code_hash               = filebase64sha256("${path.module}/../artifacts/backend.zip")
  memory_size                    = 512
  timeout                        = 25
  reserved_concurrent_executions = var.lambda_reserved_concurrency
  environment {
    variables = merge({
      AUTH_MODE               = "cognito"
      STORE_TABLE             = aws_dynamodb_table.store.name
      AUDIT_TABLE             = aws_dynamodb_table.audit.name
      COGNITO_CLIENT_ID       = aws_cognito_user_pool_client.backend.id
      COGNITO_POOL_ID         = aws_cognito_user_pool.demo.id
      PUBLIC_ORIGIN           = "https://${aws_cloudfront_distribution.site.domain_name}"
      GROQ_SECRET_ARN         = aws_secretsmanager_secret.groq.arn
      GROQ_MODEL              = "qwen/qwen3.8-27b"
      DEMO_VULNERABLE_ENABLED = tostring(var.demo_vulnerable_enabled)
      }, var.demo_vulnerable_until_utc == "" ? {} : {
      DEMO_VULNERABLE_UNTIL_UTC = var.demo_vulnerable_until_utc
    })
  }
  depends_on = [aws_iam_role_policy.lambda, aws_iam_role_policy.assistant_secret, aws_iam_role_policy.demo_group_check]
}
resource "aws_apigatewayv2_api" "store" {
  name          = var.name
  protocol_type = "HTTP"
}
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.store.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 28000
}
resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.store.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}
resource "aws_apigatewayv2_route" "login" {
  api_id    = aws_apigatewayv2_api.store.id
  route_key = "POST /api/session"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.store.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 5
    throttling_rate_limit  = 2
  }
  route_settings {
    route_key              = aws_apigatewayv2_route.login.route_key
    throttling_burst_limit = 2
    throttling_rate_limit  = 0.5
  }
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format          = jsonencode({ requestId = "$context.requestId", routeKey = "$context.routeKey", status = "$context.status", responseLength = "$context.responseLength" })
  }
}
resource "aws_lambda_permission" "gateway" {
  statement_id  = "AllowDemoMartGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.store.execution_arn}/*/*/api/*"
}
