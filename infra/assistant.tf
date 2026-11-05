# Terraform owns only the secret container. Its value is provisioned privately
# after apply, so the Groq API key never appears in Terraform state or a plan.
resource "aws_secretsmanager_secret" "groq" {
  name                    = "${var.name}/groq-api-key"
  recovery_window_in_days = 7
}

resource "aws_iam_role_policy" "assistant_secret" {
  name = "read-assistant-secret"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.groq.arn
    }]
  })
}
