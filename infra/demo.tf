# Group membership and the extra Cognito permission exist only while the
# administrator explicitly enables the synthetic vulnerable demo profile.
resource "aws_cognito_user_group" "demo" {
  count        = var.demo_vulnerable_enabled ? 1 : 0
  name         = "agentguard-vulnerable-demo"
  user_pool_id = aws_cognito_user_pool.demo.id
  description  = "Temporary approved synthetic security demonstration"
}

resource "aws_cognito_user_in_group" "demo_alice" {
  count        = var.demo_vulnerable_enabled ? 1 : 0
  user_pool_id = aws_cognito_user_pool.demo.id
  group_name   = aws_cognito_user_group.demo[0].name
  username     = "alice"
}

resource "aws_iam_role_policy" "demo_group_check" {
  count = var.demo_vulnerable_enabled ? 1 : 0
  name  = "read-demo-group-only"
  role  = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminListGroupsForUser"]
      Resource = aws_cognito_user_pool.demo.arn
    }]
  })
}
