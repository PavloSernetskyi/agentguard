"""API Gateway HTTP API v2 adapter. Cloud startup always requires Cognito."""
import base64
import binascii
import json
import os
from functools import lru_cache
from .api import handle
from .assistant import AssistantUnavailable, build_assistant
from .auth import CognitoAuthenticator
from .dynamo import DynamoStorage, DynamoAuditSink
from .service import StoreService


@lru_cache(maxsize=1)
def cloud_service():
    import boto3
    if os.environ.get("AUTH_MODE") != "cognito":
        raise RuntimeError("Cloud deployments require Cognito authentication")
    db = boto3.resource("dynamodb")
    storage = DynamoStorage(db.Table(os.environ["STORE_TABLE"]))
    audit = DynamoAuditSink(db.Table(os.environ["AUDIT_TABLE"]))
    auth = CognitoAuthenticator(boto3.client("cognito-idp"), os.environ["COGNITO_CLIENT_ID"], storage)
    service = StoreService(storage, audit, authenticator=auth)
    try:
        service.assistant = build_assistant(service, storage)
    except AssistantUnavailable:
        service.assistant = None
    return service


def respond(status, message):
    return {"statusCode": status, "headers": {"content-type": "application/json", "cache-control": "no-store"}, "body": json.dumps({"error": message})}


def adapt(event, service, allowed_origin):
    if event.get("version") != "2.0":
        return respond(400, "Unsupported gateway payload")
    headers = {k.lower(): v for k, v in event.get("headers", {}).items()}
    if event.get("cookies"):
        headers["cookie"] = "; ".join(event["cookies"])
    try:
        body = event.get("body") or ""
        if len(body) > 24000:
            return respond(413, "Request too large")
        if event.get("isBase64Encoded"):
            body = base64.b64decode(body, validate=True).decode("utf-8")
        if len(body.encode("utf-8")) > 16384:
            return respond(413, "Request too large")
    except (ValueError, UnicodeError, binascii.Error):
        return respond(400, "Invalid request encoding")
    path = event.get("rawPath", "/")
    if event.get("rawQueryString"):
        path += "?" + event["rawQueryString"]
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    status, response_headers, payload = handle(service, method, path, headers, body,
                                              allowed_origins={allowed_origin}, secure_cookie=True,
                                              assistant=getattr(service, "assistant", None))
    cookies = []
    if "Set-Cookie" in response_headers:
        cookies.append(response_headers.pop("Set-Cookie"))
    return {"statusCode": status, "headers": response_headers, "cookies": cookies, "body": json.dumps(payload)}


def handler(event, context):
    try:
        origin = os.environ["PUBLIC_ORIGIN"]
        if not origin.startswith("https://"):
            raise RuntimeError("HTTPS origin required")
        return adapt(event, cloud_service(), origin)
    except Exception:
        # Never log event bodies, credentials, cookies or provider exceptions.
        print(json.dumps({"event": "request_failed", "lambda_request_id": getattr(context, "aws_request_id", None)}))
        return respond(503, "Service temporarily unavailable")
