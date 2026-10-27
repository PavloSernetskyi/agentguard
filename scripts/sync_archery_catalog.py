"""Guarded one-time update of the hosted synthetic catalog and original demo orders.

Dry run by default. Run with --apply only after reviewing the output and backing up
the existing Terraform state. This does not touch customers, sessions, carts, other
orders, or audit events.
"""

import argparse
from decimal import Decimal
import json
from pathlib import Path
import sys

import boto3
from boto3.dynamodb.conditions import Attr

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from seed.reset import seed

ACCOUNT = "783582650755"
REGION = "us-east-2"
TABLE = "demomart-demo-store"
OLD_PRODUCTS = {
    "p01": "Daybreak wireless headphones",
    "p02": "Everyday canvas backpack",
    "p03": "Slow morning ceramic mug",
    "p04": "Arc desk lamp",
    "p05": "Trail insulated bottle",
    "p06": "Pocket bluetooth speaker",
    "p07": "Soft landing cotton throw",
    "p08": "Field notes notebook set",
    "p09": "Pebble wireless mouse",
    "p10": "Studio everyday pen set",
}


class Collector:
    def __init__(self):
        self.records = {}

    def put(self, collection, key, value):
        self.records[(collection, key)] = value

    def get(self, collection, key):
        return self.records.get((collection, key))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write only the reviewed catalog and original demo orders")
    parser.add_argument("--profile", default="agentguard")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=REGION)
    actual = session.client("sts").get_caller_identity()["Account"]
    if actual != ACCOUNT:
        raise SystemExit(f"Wrong AWS account: {actual}")
    table = session.resource("dynamodb").Table(TABLE)
    if table.table_status != "ACTIVE":
        raise SystemExit(f"Store table is not ACTIVE: {TABLE}")

    wanted = Collector()
    seed(wanted)
    changes = []
    backup = []
    for (collection, key), value in wanted.records.items():
        if collection not in {"products", "orders"}:
            continue
        value = json.loads(json.dumps(value), parse_float=Decimal)
        current = table.get_item(Key={"pk": collection, "sk": key}, ConsistentRead=True).get("Item")
        replacement = {"pk": collection, "sk": key, "value": value}
        if collection == "orders":
            replacement["owner_pk"] = "orders#" + value["customer_id"]
        if current == replacement:
            continue
        if collection == "products":
            old_name = OLD_PRODUCTS.get(key)
            if old_name:
                if not current or current.get("value", {}).get("name") != old_name:
                    raise SystemExit(f"Unexpected existing product {key}; no writes performed")
                condition = Attr("value.name").eq(old_name)
            else:
                if current:
                    raise SystemExit(f"Unexpected new product {key}; no writes performed")
                condition = Attr("pk").not_exists()
        else:
            old_name = OLD_PRODUCTS["p01" if key == "ord-alice-001" else "p02"]
            if (not current or current.get("value", {}).get("customer_id") != value["customer_id"]
                    or current.get("value", {}).get("items", [{}])[0].get("name") != old_name
                    or current.get("value", {}).get("transaction") != "synthetic-no-payment"):
                raise SystemExit(f"Unexpected original demo order {key}; no writes performed")
            condition = Attr("value.customer_id").eq(value["customer_id"]) & Attr("value.items[0].name").eq(old_name)
        changes.append((collection, key, replacement, condition))
        if current:
            backup.append(current)

    print(f"Account {ACCOUNT}, region {REGION}, table {TABLE}")
    print(f"Changes: {sum(c == 'products' for c, *_ in changes)} products, {sum(c == 'orders' for c, *_ in changes)} original orders")
    if not changes:
        print("Already in sync")
        return
    if not args.apply:
        print("Dry run only. Re-run with --apply after reviewing this scope.")
        return

    target = ROOT / "artifacts" / "archery-catalog-backup.json"
    target.parent.mkdir(exist_ok=True)
    if target.exists():
        raise SystemExit(f"Backup already exists: {target}; move it privately before another apply")
    target.write_text(json.dumps(backup, indent=2, default=str) + "\n", encoding="utf-8")
    print(f"Backed up {len(backup)} existing records to ignored {target}")
    for collection, key, replacement, condition in changes:
        table.put_item(Item=replacement, ConditionExpression=condition)
        print(f"Updated {collection}/{key}")


if __name__ == "__main__":
    main()
