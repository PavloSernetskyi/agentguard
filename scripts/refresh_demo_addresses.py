"""Update only Alice and Bob's existing synthetic AWS delivery addresses.

Dry run: python scripts/refresh_demo_addresses.py
Apply: python scripts/refresh_demo_addresses.py --apply
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

import boto3
from boto3.dynamodb.conditions import Attr


ACCOUNT = "783582650755"
REGION = "us-east-2"
TABLE = "demomart-demo-store"
ROOT = Path(__file__).resolve().parents[1]
OLD = {
    account: f"{account.title()}, 100 Example Lane, Fiction City, ZZ 00000"
    for account in ("alice", "bob")
}
NEW = {
    "alice": "Alice, 209 Willow Creek Road, Columbus, OH 43215",
    "bob": "Bob, 1847 Parkside Drive, Columbus, OH 43215",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    session = boto3.Session(profile_name="agentguard", region_name=REGION)
    if session.client("sts").get_caller_identity()["Account"] != ACCOUNT:
        raise SystemExit("Wrong AWS account")
    table = session.resource("dynamodb").Table(TABLE)
    if table.table_status != "ACTIVE":
        raise SystemExit("Store table is not active")

    rows = []
    for account in ("alice", "bob"):
        row = table.get_item(Key={"pk": "customers", "sk": account}, ConsistentRead=True).get("Item")
        if not row or row.get("value", {}).get("id") != account:
            raise SystemExit(f"Unexpected {account} customer record")
        rows.append((row, account))
    scan = {"FilterExpression": Attr("pk").eq("orders")}
    while True:
        page = table.scan(**scan)
        for row in page["Items"]:
            order = row.get("value", {})
            account = order.get("customer_id")
            if account in NEW:
                if order.get("id") != row.get("sk") or order.get("transaction") != "synthetic-no-payment":
                    raise SystemExit(f"Unexpected order record: {row.get('sk')}")
                rows.append((row, account))
        if "LastEvaluatedKey" not in page:
            break
        scan["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    changes = []
    for row, account in rows:
        address = row["value"].get("address")
        if address not in (OLD[account], NEW[account]):
            raise SystemExit(f"Unexpected address on {row['pk']}/{row['sk']}")
        if address == OLD[account]:
            changes.append((row, account))
    print(f"Account {ACCOUNT}: {len(changes)} synthetic customer/order addresses to update")
    if not args.apply or not changes:
        print("Dry run only" if not args.apply else "Already in sync")
        return
    backup = ROOT / "artifacts" / ("demo-address-backup-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json")
    backup.parent.mkdir(exist_ok=True)
    backup.write_text(json.dumps([row for row, _ in changes], indent=2, default=str) + "\n", encoding="utf-8")
    for row, account in changes:
        table.update_item(
            Key={"pk": row["pk"], "sk": row["sk"]},
            UpdateExpression="SET #v.#address = :new",
            ConditionExpression="#v.#address = :old AND #v.#owner = :owner",
            ExpressionAttributeNames={"#v": "value", "#address": "address",
                                      "#owner": "id" if row["pk"] == "customers" else "customer_id"},
            ExpressionAttributeValues={":old": OLD[account], ":new": NEW[account], ":owner": account},
        )
        print(f"Updated {row['pk']}/{row['sk']}")
    print(f"Backup: {backup}")


if __name__ == "__main__":
    main()
