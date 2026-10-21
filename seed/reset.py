"""Reset only DemoMart's local database. Run: python -m seed.reset"""
from pathlib import Path
from backend.storage import SQLiteStorage

DB_PATH = Path(__file__).resolve().parents[1] / "backend" / "data" / "demomart.sqlite3"
CATALOG = [
    ("p01", "Daybreak wireless headphones", "Electronics", 7900, "headphones", "#d9e7df", "Your quiet corner, wherever you go.", 4.8),
    ("p02", "Everyday canvas backpack", "Everyday carry", 4800, "backpack", "#e9dfcf", "Room for your day. Made for the everyday.", 4.7),
    ("p03", "Slow morning ceramic mug", "Home & living", 1800, "mug", "#e6d5c9", "A comfortable handle and a beautifully simple finish.", 4.9),
    ("p04", "Arc desk lamp", "Home & living", 5400, "lamp", "#e2e5ce", "A warm pool of light for your favorite workspace.", 4.6),
    ("p05", "Trail insulated bottle", "Everyday carry", 2600, "bottle", "#d3e4e7", "Keep a little refreshment close at hand.", 4.8),
    ("p06", "Pocket bluetooth speaker", "Electronics", 3900, "speaker", "#dddcec", "Small size. A soundtrack for every room.", 4.5),
    ("p07", "Soft landing cotton throw", "Home & living", 4200, "throw", "#e8d8ce", "An extra layer of comfort for slow evenings.", 4.7),
    ("p08", "Field notes notebook set", "Stationery", 1600, "notebook", "#dbe3d3", "Three blank notebooks for your next bright idea.", 4.8),
    ("p09", "Pebble wireless mouse", "Electronics", 2900, "mouse", "#dce3e8", "A smooth, simple companion for your desk.", 4.4),
    ("p10", "Studio everyday pen set", "Stationery", 1200, "pens", "#ebdfc8", "Five satisfying pens, ready when inspiration strikes.", 4.6),
]


def seed(storage):
    for pid, name, category, price, illustration, color, description, rating in CATALOG:
        storage.put("products", pid, dict(id=pid, name=name, category=category, price=price, illustration=illustration, color=color, description=description + " Designed for this fictional DemoMart catalog; specifications and reviews are synthetic.", rating=rating, reviews=[{"author": "Demo reviewer 01", "rating": 5, "text": "A useful addition to my everyday routine. A synthetic review for this demo."}, {"author": "Demo reviewer 02", "rating": 4, "text": "Simple design and a lovely finish. This review is fictional."}]))
    for account, product in [("alice", "p01"), ("bob", "p02")]:
        storage.put("customers", account, {"id": account, "name": account.title() + " Demo"})
        storage.put("orders", "ord-" + account + "-001", {"id": "ord-" + account + "-001", "customer_id": account, "date": "2026-10-12", "status": "Delivered", "address": account.title() + " Demo, 100 Example Lane, Fiction City, ZZ 00000", "items": [{"product_id": product, "name": storage.get("products", product)["name"], "quantity": 1, "unit_price": storage.get("products", product)["price"]}], "total": storage.get("products", product)["price"], "transaction": "synthetic-no-payment"})


if __name__ == "__main__":
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    seed(SQLiteStorage(DB_PATH))
    print("Reset synthetic catalog, accounts, orders, carts, sessions and audit events:", DB_PATH)
