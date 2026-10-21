resource "aws_cognito_user_pool" "demo" {
  name                = "${var.name}-users"
  user_pool_tier      = "ESSENTIALS"
  deletion_protection = "INACTIVE"
  admin_create_user_config { allow_admin_create_user_only = true }
  password_policy {
    minimum_length                   = 14
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 1
  }
  username_configuration { case_sensitive = false }
  account_recovery_setting {
    recovery_mechanism {
      name     = "admin_only"
      priority = 1
    }
  }
}
resource "aws_cognito_user_pool_client" "backend" {
  name                          = "${var.name}-backend"
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
