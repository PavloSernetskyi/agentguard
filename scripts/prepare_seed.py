"""Generate synthetic cloud seed records locally. Does not connect to AWS."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from seed.reset import seed


class Collector:
    def __init__(self):
        self.records = {}

    def put(self, collection, key, value):
        self.records[(collection, key)] = value

    def get(self, collection, key):
        return self.records.get((collection, key))


def marshal(value):
    if isinstance(value, dict):
        return {"M": {k: marshal(v) for k, v in value.items()}}
    if isinstance(value, list):
        return {"L": [marshal(v) for v in value]}
    if isinstance(value, str):
        return {"S": value}
    if isinstance(value, bool):
        return {"BOOL": value}
    if value is None:
        return {"NULL": True}
    return {"N": str(value)}


def main():
    collector = Collector()
    seed(collector)
    items = []
    for (collection, key), value in collector.records.items():
        item = {"pk": collection, "sk": key, "value": value}
        if collection == "orders":
            item["owner_pk"] = "orders#" + value["customer_id"]
        items.append(marshal(item)["M"])
    target = ROOT / "artifacts" / "seed-items.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(items)} synthetic records: {target}")


if __name__ == "__main__":
    main()
