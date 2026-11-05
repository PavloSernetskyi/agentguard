"""Operator-only, read-only DynamoDB audit feed for API Gateway HTTP API v2."""
import base64
import binascii
import json
import os
from functools import lru_cache
from http.cookies import SimpleCookie
from .dynamo import plain


OPERATOR = "soc-operator"
GROUP = "agentguard-soc-operators"


def _response(status, payload, cookie=None):
    headers = {"content-type": "application/json", "cache-control": "no-store",
               "x-content-type-options": "nosniff"}
    result = {"statusCode": status, "headers": headers, "body": json.dumps(payload)}
    if cookie:
        result["cookies"] = [cookie]
    return result


@lru_cache(maxsize=1)
def _clients():
    import boto3
    return boto3.client("cognito-idp"), boto3.resource("dynamodb").Table(os.environ["AUDIT_TABLE"])


def _operator(cognito, token):
    if not token:
        return False
    try:
        user = cognito.get_user(AccessToken=token)
        if user.get("Username") != OPERATOR:
            return False
        groups = cognito.admin_list_groups_for_user(
            UserPoolId=os.environ["COGNITO_POOL_ID"], Username=OPERATOR).get("Groups", [])
        return any(group.get("GroupName") == GROUP for group in groups)
    except Exception:
        return False


def _cookie(headers, event):
    raw = "; ".join(event.get("cookies", [])) or headers.get("cookie", "")
    try:
        jar = SimpleCookie()
        jar.load(raw)
        return jar["soc_session"].value if "soc_session" in jar else ""
    except Exception:
        return ""


def _cursor(value):
    if not value:
        return None
    if len(value) > 2048:
        raise ValueError("cursor too long")
    padded = value + "=" * (-len(value) % 4)
    key = json.loads(base64.urlsafe_b64decode(padded))
    if not isinstance(key, dict) or set(key) != {"timeline_pk", "timeline_sk", "request_id", "event_id"}:
        raise ValueError("invalid cursor")
    if not all(isinstance(item, str) and 0 < len(item) < 160 for item in key.values()) or key["timeline_pk"] != "audit":
        raise ValueError("invalid cursor")
    return key


def _events(table, query):
    from boto3.dynamodb.conditions import Key
    from urllib.parse import parse_qs

    params = parse_qs(query, keep_blank_values=True, max_num_fields=4)
    if set(params) - {"limit", "cursor"} or any(len(items) != 1 for items in params.values()):
        raise ValueError("invalid query")
    limit = int(params.get("limit", ["100"])[0])
    if not 1 <= limit <= 500:
        raise ValueError("invalid limit")
    cursor = _cursor(params.get("cursor", [""])[0])
    args = {"IndexName": "by_time", "KeyConditionExpression": Key("timeline_pk").eq("audit"),
            "ScanIndexForward": False, "Limit": limit}
    if cursor:
        args["ExclusiveStartKey"] = cursor
    page = table.query(**args)
    # The index projects only audit records; never return DynamoDB keys or TTL fields.
    events = [plain(item["value"]) for item in page.get("Items", [])]
    next_key = page.get("LastEvaluatedKey")
    next_cursor = base64.urlsafe_b64encode(json.dumps(next_key).encode()).decode().rstrip("=") if next_key else None
    return {"source": "cloud-dynamodb", "events": events, "next_cursor": next_cursor}


def handle(event, cognito=None, table=None):
    if event.get("version") != "2.0":
        return _response(400, {"error": "Unsupported gateway payload"})
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path = event.get("rawPath", "")
    headers = {key.lower(): value for key, value in event.get("headers", {}).items()}
    if cognito is None or table is None:
        cognito, table = _clients()

    if path == "/soc-api/session" and method == "POST":
        if headers.get("origin") != os.environ["PUBLIC_ORIGIN"]:
            return _response(403, {"error": "Origin denied"})
        try:
            if event.get("isBase64Encoded") or len(event.get("body", "")) > 2048:
                raise ValueError()
            data = json.loads(event.get("body") or "")
            if not isinstance(data, dict) or set(data) != {"password"} or not isinstance(data["password"], str):
                raise ValueError()
            if not 14 <= len(data["password"]) <= 256:
                raise ValueError()
        except (ValueError, TypeError):
            return _response(400, {"error": "Invalid sign-in request"})
        try:
            result = cognito.initiate_auth(ClientId=os.environ["COGNITO_SOC_CLIENT_ID"],
                AuthFlow="USER_PASSWORD_AUTH", AuthParameters={"USERNAME": OPERATOR, "PASSWORD": data["password"]})
            token = result["AuthenticationResult"]["AccessToken"]
            if not _operator(cognito, token):
                return _response(401, {"error": "Operator access denied"})
            return _response(200, {"operator": True},
                             f"soc_session={token}; HttpOnly; Secure; SameSite=Strict; Path=/soc-api; Max-Age=3600")
        except Exception:
            return _response(401, {"error": "Operator access denied"})

    if path == "/soc-api/session" and method == "DELETE":
        if headers.get("origin", "") not in {"", os.environ["PUBLIC_ORIGIN"]}:
            return _response(403, {"error": "Origin denied"})
        return _response(200, {"operator": False},
                         "soc_session=; HttpOnly; Secure; SameSite=Strict; Path=/soc-api; Max-Age=0")

    if path not in {"/soc-api/events", "/soc-api/health"}:
        return _response(404, {"error": "Route not found"})
    if not _operator(cognito, _cookie(headers, event)):
        return _response(401, {"error": "Operator sign-in required"})
    if method != "GET":
        return _response(405, {"error": "Reporting is read-only"})
    if path == "/soc-api/health":
        return _response(200, {"source": "cloud-dynamodb", "read_only": True})
    try:
        return _response(200, _events(table, event.get("rawQueryString", "")))
    except (ValueError, TypeError, UnicodeError, binascii.Error):
        return _response(400, {"error": "Invalid reporting query"})
    except Exception:
        return _response(503, {"error": "Audit feed temporarily unavailable"})


def handler(event, context):
    try:
        return handle(event)
    except Exception:
        return _response(503, {"error": "Reporting unavailable"})
