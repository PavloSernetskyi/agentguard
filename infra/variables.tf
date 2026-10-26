variable "region" {
  type    = string
  default = "us-east-2"
  validation {
    condition     = var.region == "us-east-2"
    error_message = "This reviewed demo targets us-east-2. Review costs before changing regions."
  }
}
variable "account_id" {
  type        = string
  description = "Expected AWS account; prevents applying to the wrong account."
  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "Supply the expected 12-digit AWS account ID."
  }
}
variable "name" {
  type    = string
  default = "demomart-demo"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.name))
    error_message = "Use a short lowercase resource prefix."
  }
}
variable "budget_email" {
  type        = string
  sensitive   = true
  description = "Private email for $1/$3/$5 actual-spend notifications."
  validation {
    condition     = can(regex("^[^@ ]+@[^@ ]+\\.[^@ ]+$", var.budget_email))
    error_message = "Supply an email address for budget notifications."
  }
}
variable "lambda_reserved_concurrency" {
  type        = number
  default     = -1
  description = "-1 leaves reservation unset for low-quota accounts. Set 5 only if account quota permits; API throttles still apply."
  validation {
    condition     = contains([-1, 5], var.lambda_reserved_concurrency)
    error_message = "Use -1 or the reviewed reservation of 5."
  }
}
