resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.name}-s3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
resource "aws_cloudfront_origin_request_policy" "api" {
  name = "${var.name}-api-forwarding"
  cookies_config { cookie_behavior = "all" }
  query_strings_config { query_string_behavior = "all" }
  headers_config {
    header_behavior = "whitelist"
    headers { items = ["Origin", "Content-Type"] }
  }
}
resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  comment             = "DemoMart school demo - pay as you go"
  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }
  origin {
    domain_name = replace(aws_apigatewayv2_api.store.api_endpoint, "https://", "")
    origin_id   = "api"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  default_cache_behavior {
    target_origin_id       = "site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }
  # No global 403-to-index rewrite: API authorization errors must remain errors.
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate { cloudfront_default_certificate = true }
}
locals {
  mime_types = { html = "text/html", js = "application/javascript", css = "text/css", svg = "image/svg+xml", json = "application/json", ico = "image/x-icon", webp = "image/webp" }
}
resource "aws_s3_object" "site" {
  for_each      = fileset("${path.module}/../artifacts/store", "**")
  bucket        = aws_s3_bucket.site.id
  key           = each.value
  source        = "${path.module}/../artifacts/store/${each.value}"
  etag          = filemd5("${path.module}/../artifacts/store/${each.value}")
  content_type  = lookup(local.mime_types, reverse(split(".", each.value))[0], "application/octet-stream")
  cache_control = each.value == "index.html" ? "no-cache,max-age=0,must-revalidate" : "public,max-age=31536000,immutable"
}
