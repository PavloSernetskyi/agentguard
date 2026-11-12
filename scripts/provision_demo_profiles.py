"""Add invalid demo payment labels to the existing synthetic AWS customer profiles.

Dry run: python scripts/provision_demo_profiles.py
Apply: python scripts/provision_demo_profiles.py --apply
No Cognito attributes or payment credentials are created.
"""
import argparse
import json
from pathlib import Path

import boto3


ACCOUNT = "783582650755"
REGION = "us-east-2"
TABLE = "demomart-demo-store"
ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    session = boto3.Session(profile_name="agentguard", region_name=REGION)
    if session.client("sts").get_caller_identity()["Account"] != ACCOUNT:
        raise SystemExit("Wrong AWS account")
    table = session.resource("dynamodb").Table(TABLE)
    pending = []
    for account in ("alice", "bob"):
        item = table.get_item(Key={"pk": "customers", "sk": account}, ConsistentRead=True).get("Item")
        order = table.get_item(Key={"pk": "orders", "sk": f"ord-{account}-001"}, ConsistentRead=True).get("Item")
        customer = item.get("value") if item else None
        fixture = order.get("value") if order else None
        address = ("Alice, 209 Willow Creek Road, Columbus, OH 43215" if account == "alice"
                   else "Bob, 1847 Parkside Drive, Columbus, OH 43215")
        label = f"{account.upper()}-DEMO-CARD-INVALID"
        if not customer or customer.get("id") != account or customer.get("name") != account.title() or customer.get("address") not in (None, address):
            raise SystemExit(f"Unexpected {account} customer fixture; no writes performed")
        if not fixture or fixture.get("customer_id") != account or fixture.get("address") != address or fixture.get("transaction") != "synthetic-no-payment":
            raise SystemExit(f"Unexpected {account} order fixture; no writes performed")
        if customer.get("address") == address and customer.get("demo_payment_label") == label:
            continue
        if customer.get("demo_payment_label") not in (None, label):
            raise SystemExit(f"Unexpected {account} payment label; no writes performed")
        pending.append((account, address, label, customer))
    print(f"Synthetic profile changes in account {ACCOUNT}: {len(pending)} customer addresses and invalid demo labels, no order or Cognito changes")
    if not args.apply or not pending:
        print("Dry run only" if not args.apply else "Already in sync")
        return
    backup = ROOT / "artifacts" / "demo-profile-backup.json"
    backup.parent.mkdir(exist_ok=True)
    if backup.exists():
        raise SystemExit("Ignored backup already exists; review it before another write")
    backup.write_text(json.dumps({account: customer for account, _, _, customer in pending}, indent=2) + "\n", encoding="utf-8")
    for account, address, label, _ in pending:
        table.update_item(
            Key={"pk": "customers", "sk": account},
            UpdateExpression="SET #v.#addr = :address, #v.#label = :label",
            ConditionExpression="#v.#id = :id AND #v.#name = :name AND "
                                "(attribute_not_exists(#v.#addr) OR #v.#addr = :address) AND "
                                "(attribute_not_exists(#v.#label) OR #v.#label = :label)",
            ExpressionAttributeNames={"#v": "value", "#label": "demo_payment_label", "#id": "id", "#name": "name", "#addr": "address"},
            ExpressionAttributeValues={":label": label, ":id": account, ":name": account.title(), ":address": address},
        )
        print(f"Updated synthetic customer/{account}; fictional address and invalid demo label")


if __name__ == "__main__":
    main()
