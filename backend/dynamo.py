"""DynamoDB adapters. No scans; cart/session reads are strongly consistent."""
import json
import time
from decimal import Decimal


def plain(value):
    return json.loads(json.dumps(value, default=lambda v: int(v) if v == int(v) else float(v)))


def dynamo(value):
    return json.loads(json.dumps(value), parse_float=Decimal)


class DynamoStorage:
    def __init__(self, table):
        self.table = table

    @staticmethod
    def key(collection, key):
        if collection == "cart":
            owner, product = key.split(":", 1)
            return {"pk": "cart#" + owner, "sk": product}
        return {"pk": collection, "sk": key}

    def get(self, collection, key):
        item = self.table.get_item(Key=self.key(collection, key), ConsistentRead=True).get("Item")
        return plain(item["value"]) if item else None

    def put(self, collection, key, value):
        item = {**self.key(collection, key), "value": dynamo(value)}
        if collection == "orders":
            item["owner_pk"] = "orders#" + value["customer_id"]
        if collection == "sessions":
            item["expires"] = int(value["expires"])
        self.table.put_item(Item=item)

    def delete(self, collection, key):
        self.table.delete_item(Key=self.key(collection, key))

    def query(self, partition, index=None):
        args = {"KeyConditionExpression": "#pk = :pk", "ExpressionAttributeNames": {"#pk": "owner_pk" if index else "pk"}, "ExpressionAttributeValues": {":pk": partition}}
        if index:
            args["IndexName"] = index
        else:
            args["ConsistentRead"] = True
        values = []
        while True:
            page = self.table.query(**args)
            values.extend(plain(item["value"]) for item in page.get("Items", []))
            if not page.get("LastEvaluatedKey"):
                return values
            args["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    def list(self, collection):
        if collection not in {"products", "customers"}:
            raise ValueError("Use owner-scoped queries for private collections")
        return self.query(collection)

    def list_owned(self, collection, customer_id):
        if collection == "cart":
            return self.query("cart#" + customer_id)
        if collection == "orders":
            # GSI is eventually consistent; service still filters trusted ownership.
            return self.query("orders#" + customer_id, "by_owner")
        raise ValueError("Unsupported owner collection")


class DynamoAuditSink:
    def __init__(self, table, retention_days=30):
        self.table, self.retention_days = table, retention_days

    def emit(self, event):
        self.table.put_item(
            Item={"request_id": event["request_id"], "event_id": event["event_id"],
                  "expires": int(time.time()) + self.retention_days * 86400, "value": dynamo(event)},
            ConditionExpression="attribute_not_exists(event_id)",
        )
