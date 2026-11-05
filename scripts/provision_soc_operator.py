"""Privately create the single Cognito SOC operator and verify the hosted read-only feed."""
import getpass
import http.cookiejar
import json
import urllib.error
import urllib.request

import boto3


ACCOUNT = "783582650755"
REGION = "us-east-2"
POOL = "us-east-2_gfAF64PI8"
SITE = "https://d16nqulwj27ltb.cloudfront.net"
USER = "soc-operator"
GROUP = "agentguard-soc-operators"


def main():
    session = boto3.Session(profile_name="agentguard", region_name=REGION)
    if session.client("sts").get_caller_identity()["Account"] != ACCOUNT:
        raise SystemExit("Wrong AWS account")
    password = getpass.getpass("Private SOC operator password: ")
    repeat = getpass.getpass("Repeat SOC operator password: ")
    if password != repeat or len(password) < 14:
        raise SystemExit("Passwords must match and contain at least 14 characters")
    del repeat
    cognito = session.client("cognito-idp")
    try:
        cognito.admin_get_user(UserPoolId=POOL, Username=USER)
    except cognito.exceptions.UserNotFoundException:
        cognito.admin_create_user(UserPoolId=POOL, Username=USER, MessageAction="SUPPRESS",
                                  TemporaryPassword=password)
    cognito.admin_set_user_password(UserPoolId=POOL, Username=USER, Password=password, Permanent=True)
    cognito.admin_add_user_to_group(UserPoolId=POOL, Username=USER, GroupName=GROUP)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    payload = json.dumps({"password": password}).encode()
    req = urllib.request.Request(SITE + "/soc-api/session", data=payload, method="POST",
                                 headers={"Origin": SITE, "Content-Type": "application/json"})
    try:
        with opener.open(req, timeout=20) as response:
            if response.status != 200:
                raise SystemExit(f"Operator login returned HTTP {response.status}")
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Operator login returned HTTP {error.code}") from None
    del password, payload
    with opener.open(SITE + "/soc-api/events?limit=10", timeout=20) as response:
        body = json.load(response)
        if response.status != 200 or body.get("source") != "cloud-dynamodb":
            raise SystemExit("Hosted SOC feed verification failed")
        print(f"SOC operator verified: HTTPS feed returned {len(body['events'])} events; no event contents printed")
    try:
        urllib.request.urlopen(SITE + "/soc-api/events?limit=1", timeout=20)
        raise SystemExit("Anonymous visitor unexpectedly read the SOC feed")
    except urllib.error.HTTPError as error:
        if error.code != 401:
            raise SystemExit(f"Anonymous SOC request returned HTTP {error.code}, expected 401") from None
    print("Open " + SITE + "/soc/index.html and sign in with the private SOC operator password")


if __name__ == "__main__":
    main()
