"""Privately set Alice/Bob's Cognito passwords and trusted store identities.

Run interactively after Terraform apply and synthetic catalog seeding. The
passwords are read from the terminal without echo and are never saved locally.
"""
import getpass
import argparse
import json
import http.cookiejar
import secrets
import sys
import urllib.error
import urllib.request


SITE = "https://d16nqulwj27ltb.cloudfront.net"


def request(opener, method, path, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Origin": SITE, "Content-Type": "application/json"} if data is not None else {}
    req = urllib.request.Request(SITE + path, data=data, method=method, headers=headers)
    try:
        response = opener.open(req, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response), response.headers.get("X-Request-Id")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user", choices=("alice", "bob"),
                        help="Provision and verify one demo account")
    args = parser.parse_args()
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        raise SystemExit("Install the optional provisioning SDK: python -m pip install boto3")

    profile = "agentguard"
    session = boto3.Session(profile_name=profile, region_name="us-east-2")
    account = session.client("sts").get_caller_identity()["Account"]
    if account != "783582650755":
        raise SystemExit("Wrong AWS account; no users were changed")
    pool_id = "us-east-2_gfAF64PI8"
    table_name = "demomart-demo-store"
    cognito = session.client("cognito-idp")
    table = session.resource("dynamodb").Table(table_name)
    audit = session.resource("dynamodb").Table("demomart-demo-audit")

    for username in ((args.user,) if args.user else ("alice", "bob")):
        customer = table.get_item(Key={"pk": "customers", "sk": username}, ConsistentRead=True).get("Item")
        if not customer:
            raise SystemExit(f"Synthetic {username} customer is missing; seed first")

        password = getpass.getpass(f"Choose a private Cognito password for {username}: ")
        repeated = getpass.getpass(f"Repeat {username}'s password: ")
        if password != repeated or len(password) < 14:
            raise SystemExit("Passwords must match and contain at least 14 characters")
        # Cognito also enforces upper/lowercase, a digit and a symbol.
        if not (any(c.isupper() for c in password) and any(c.islower() for c in password)
                and any(c.isdigit() for c in password) and any(not c.isalnum() for c in password)):
            raise SystemExit("Use uppercase, lowercase, a number and a symbol")

        try:
            cognito.admin_create_user(
                UserPoolId=pool_id, Username=username, MessageAction="SUPPRESS",
                TemporaryPassword="Aa1!" + secrets.token_urlsafe(20),
            )
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") != "UsernameExistsException":
                raise
        cognito.admin_set_user_password(UserPoolId=pool_id, Username=username,
                                        Password=password, Permanent=True)

        user = cognito.admin_get_user(UserPoolId=pool_id, Username=username)
        sub = next((a["Value"] for a in user["UserAttributes"] if a["Name"] == "sub"), None)
        if not sub:
            raise SystemExit(f"Cognito did not return {username}'s subject")
        existing = table.get_item(Key={"pk": "identities", "sk": sub}, ConsistentRead=True).get("Item")
        if existing and existing["value"]["customer_id"] != username:
            raise SystemExit(f"Identity mapping conflict for {username}")
        if not existing:
            table.put_item(Item={"pk": "identities", "sk": sub,
                                 "value": {"customer_id": username}},
                           ConditionExpression="attribute_not_exists(pk)")
        print(f"{username}: Cognito password and trusted identity ready")

        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        status, _, _ = request(opener, "POST", "/api/session",
                               {"account": username, "password": password})
        if status != 200:
            raise SystemExit(f"{username}: hosted sign-in failed with HTTP {status}")
        own = f"ord-{username}-001"
        other = "ord-bob-001" if username == "alice" else "ord-alice-001"
        own_status, own_order, own_req = request(opener, "GET", "/api/orders/" + own)
        denied_status, denied_body, denied_req = request(opener, "GET", "/api/orders/" + other)
        if own_status != 200 or own_order.get("id") != own or denied_status != 403 or "customer_id" in denied_body:
            raise SystemExit(f"{username}: hosted order ownership check failed")
        for req_id, expected_decision, expected_execution in (
            (own_req, "allow", "succeeded"), (denied_req, "deny", "blocked")
        ):
            rows = audit.query(KeyConditionExpression="request_id = :rid",
                               ExpressionAttributeValues={":rid": req_id},
                               ConsistentRead=True)["Items"]
            if len(rows) != 1 or rows[0]["value"]["decision"] != expected_decision or rows[0]["value"]["execution"] != expected_execution:
                raise SystemExit(f"{username}: hosted audit verification failed")
        print(f"{username}: own order 200, other order 403, decisions audited")
        del password, repeated


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped; rerun the script to complete remaining users", file=sys.stderr)
        raise SystemExit(1)
