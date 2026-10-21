output "website_url" { value = "https://${aws_cloudfront_distribution.site.domain_name}" }
output "store_table" { value = aws_dynamodb_table.store.name }
output "audit_table" { value = aws_dynamodb_table.audit.name }
output "cognito_pool_id" { value = aws_cognito_user_pool.demo.id }
output "cognito_client_id" { value = aws_cognito_user_pool_client.backend.id }
output "distribution_id" { value = aws_cloudfront_distribution.site.id }
output "site_bucket" { value = aws_s3_bucket.site.id }
output "lambda_name" { value = aws_lambda_function.api.function_name }
