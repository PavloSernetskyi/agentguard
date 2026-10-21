resource "aws_s3_bucket" "site" {
  bucket        = "${var.name}-${var.account_id}-${var.region}-site"
  force_destroy = false
}
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontReadOnly", Effect = "Allow",
      Principal = { Service = "cloudfront.amazonaws.com" },
      Action    = "s3:GetObject", Resource = "${aws_s3_bucket.site.arn}/*",
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.site]
}
resource "aws_dynamodb_table" "store" {
  name         = "${var.name}-store"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  attribute {
    name = "owner_pk"
    type = "S"
  }
  global_secondary_index {
    name            = "by_owner"
    hash_key        = "owner_pk"
    range_key       = "sk"
    projection_type = "ALL"
  }
  ttl {
    attribute_name = "expires"
    enabled        = true
  }
  server_side_encryption { enabled = true }
  on_demand_throughput {
    max_read_request_units  = 20
    max_write_request_units = 20
  }
}
resource "aws_dynamodb_table" "audit" {
  name         = "${var.name}-audit"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "request_id"
  range_key    = "event_id"
  attribute {
    name = "request_id"
    type = "S"
  }
  attribute {
    name = "event_id"
    type = "S"
  }
  ttl {
    attribute_name = "expires"
    enabled        = true
  }
  server_side_encryption { enabled = true }
  on_demand_throughput {
    max_read_request_units  = 10
    max_write_request_units = 20
  }
}
